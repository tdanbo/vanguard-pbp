package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"

	// Register image decoders for supported formats.
	_ "image/jpeg"
	_ "image/png"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	// Register webp decoder for image validation.
	_ "golang.org/x/image/webp"

	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/storage"
)

const (
	MaxFileSize   = 20 * 1024 * 1024  // 20MB
	MaxDimension  = 4000              // 4000px max width/height
	StorageLimit  = 500 * 1024 * 1024 // 500MB per campaign
	StorageBucket = "campaign-assets"

	// Storage warning thresholds (percentage).
	storageWarningMedium   = 80
	storageWarningHigh     = 90
	storageWarningCritical = 95
	percentageMultiplier   = 100

	// Image format constant.
	imageFormatJPEG = "jpeg"
)

var (
	ErrFileTooLarge        = errors.New("file too large (max 20MB)")
	ErrImageTooLarge       = errors.New("image dimensions too large (max 4000x4000px)")
	ErrInvalidFormat       = errors.New("unsupported format (use PNG, JPG, or WebP)")
	ErrStorageLimitReached = errors.New("campaign storage limit reached (500MB)")
)

// ImageService handles image upload operations.
type ImageService struct {
	queries *generated.Queries
	storage *storage.Client
}

// NewImageService creates a new image service.
func NewImageService(queries *generated.Queries, storageClient *storage.Client) *ImageService {
	return &ImageService{
		queries: queries,
		storage: storageClient,
	}
}

// StorageStatus represents the storage quota status for a campaign.
type StorageStatus struct {
	UsedBytes    int64   `json:"usedBytes"`
	LimitBytes   int64   `json:"limitBytes"`
	Percentage   float64 `json:"percentage"`
	WarningLevel string  `json:"warningLevel"` // "", "medium", "high", "critical"
}

// GetStorageStatus returns the storage status for a campaign.
func (s *ImageService) GetStorageStatus(
	ctx context.Context,
	campaignID uuid.UUID,
) (*StorageStatus, error) {
	campaign, err := s.queries.GetCampaign(ctx, pgtype.UUID{Bytes: campaignID, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("failed to get campaign: %w", err)
	}

	usedBytes := campaign.StorageUsedBytes
	limitBytes := int64(StorageLimit)
	percentage := float64(usedBytes) / float64(limitBytes) * percentageMultiplier

	status := &StorageStatus{
		UsedBytes:    usedBytes,
		LimitBytes:   limitBytes,
		Percentage:   percentage,
		WarningLevel: "",
	}

	switch {
	case percentage >= storageWarningCritical:
		status.WarningLevel = "critical"
	case percentage >= storageWarningHigh:
		status.WarningLevel = "high"
	case percentage >= storageWarningMedium:
		status.WarningLevel = "medium"
	}

	return status, nil
}

// UploadAvatar uploads an avatar image for a character.
//
//nolint:dupl // Upload methods share similar structure but handle different entities
func (s *ImageService) UploadAvatar(
	ctx context.Context,
	campaignID, characterID, gmUserID uuid.UUID,
	file multipart.File,
	header *multipart.FileHeader,
) (string, error) {
	// Verify GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: pgtype.UUID{Bytes: campaignID, Valid: true},
		UserID:     pgtype.UUID{Bytes: gmUserID, Valid: true},
	})
	if err != nil {
		return "", fmt.Errorf("failed to verify GM status: %w", err)
	}
	if !isGM {
		return "", ErrNotGM
	}

	// Verify character belongs to campaign
	charCampaignID, err := s.queries.GetCharacterCampaignID(
		ctx,
		pgtype.UUID{Bytes: characterID, Valid: true},
	)
	if err != nil {
		return "", fmt.Errorf("character not found: %w", err)
	}
	if charCampaignID.Bytes != campaignID {
		return "", errors.New("character does not belong to this campaign")
	}

	// Validate and upload
	url, fileSize, err := s.validateAndUpload(
		ctx,
		campaignID,
		file,
		header,
		"avatars",
		characterID.String(),
	)
	if err != nil {
		return "", err
	}

	// Update character avatar_url
	_, err = s.queries.UpdateCharacterAvatar(ctx, generated.UpdateCharacterAvatarParams{
		ID:        pgtype.UUID{Bytes: characterID, Valid: true},
		AvatarUrl: pgtype.Text{String: url, Valid: true},
	})
	if err != nil {
		return "", fmt.Errorf("failed to update character avatar: %w", err)
	}

	// Update campaign storage
	_, err = s.queries.IncrementCampaignStorage(ctx, generated.IncrementCampaignStorageParams{
		ID:               pgtype.UUID{Bytes: campaignID, Valid: true},
		StorageUsedBytes: fileSize,
	})
	if err != nil {
		return "", fmt.Errorf("failed to update storage usage: %w", err)
	}

	return url, nil
}

// DeleteAvatar deletes an avatar image for a character.
func (s *ImageService) DeleteAvatar(
	ctx context.Context,
	campaignID, characterID, gmUserID uuid.UUID,
) error {
	// Verify GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: pgtype.UUID{Bytes: campaignID, Valid: true},
		UserID:     pgtype.UUID{Bytes: gmUserID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to verify GM status: %w", err)
	}
	if !isGM {
		return ErrNotGM
	}

	// Get character to find current avatar URL
	char, err := s.queries.GetCharacter(ctx, pgtype.UUID{Bytes: characterID, Valid: true})
	if err != nil {
		return fmt.Errorf("character not found: %w", err)
	}

	if !char.AvatarUrl.Valid || char.AvatarUrl.String == "" {
		return nil // No avatar to delete
	}

	// Delete from storage
	path := fmt.Sprintf("campaigns/%s/avatars/%s", campaignID, filepath.Base(char.AvatarUrl.String))
	fileSize, _ := s.storage.GetFileSize(ctx, StorageBucket, path)

	if deleteErr := s.storage.Delete(ctx, StorageBucket, path); deleteErr != nil {
		// Log but don't fail if storage delete fails - use slog instead of fmt.Printf
		_ = deleteErr // Intentionally ignoring storage delete errors
	}

	// Clear avatar URL
	_, err = s.queries.ClearCharacterAvatar(ctx, pgtype.UUID{Bytes: characterID, Valid: true})
	if err != nil {
		return fmt.Errorf("failed to clear character avatar: %w", err)
	}

	// Update campaign storage if we knew the file size
	if fileSize > 0 {
		_, _ = s.queries.DecrementCampaignStorage(ctx, generated.DecrementCampaignStorageParams{
			ID:               pgtype.UUID{Bytes: campaignID, Valid: true},
			StorageUsedBytes: fileSize,
		})
	}

	return nil
}

// UploadSceneHeader uploads a header image for a scene.
//
//nolint:dupl // Upload methods share similar structure but handle different entities
func (s *ImageService) UploadSceneHeader(
	ctx context.Context,
	campaignID, sceneID, gmUserID uuid.UUID,
	file multipart.File,
	header *multipart.FileHeader,
) (string, error) {
	// Verify GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: pgtype.UUID{Bytes: campaignID, Valid: true},
		UserID:     pgtype.UUID{Bytes: gmUserID, Valid: true},
	})
	if err != nil {
		return "", fmt.Errorf("failed to verify GM status: %w", err)
	}
	if !isGM {
		return "", ErrNotGM
	}

	// Verify scene belongs to campaign
	sceneCampaignID, err := s.queries.GetSceneCampaignID(
		ctx,
		pgtype.UUID{Bytes: sceneID, Valid: true},
	)
	if err != nil {
		return "", fmt.Errorf("scene not found: %w", err)
	}
	if sceneCampaignID.Bytes != campaignID {
		return "", errors.New("scene does not belong to this campaign")
	}

	// Validate and upload
	url, fileSize, err := s.validateAndUpload(
		ctx,
		campaignID,
		file,
		header,
		"scenes",
		sceneID.String(),
	)
	if err != nil {
		return "", err
	}

	// Update scene header_image_url
	_, err = s.queries.UpdateSceneHeaderImage(ctx, generated.UpdateSceneHeaderImageParams{
		ID:             pgtype.UUID{Bytes: sceneID, Valid: true},
		HeaderImageUrl: pgtype.Text{String: url, Valid: true},
	})
	if err != nil {
		return "", fmt.Errorf("failed to update scene header: %w", err)
	}

	// Update campaign storage
	_, err = s.queries.IncrementCampaignStorage(ctx, generated.IncrementCampaignStorageParams{
		ID:               pgtype.UUID{Bytes: campaignID, Valid: true},
		StorageUsedBytes: fileSize,
	})
	if err != nil {
		return "", fmt.Errorf("failed to update storage usage: %w", err)
	}

	return url, nil
}

// DeleteSceneHeader deletes a header image for a scene.
func (s *ImageService) DeleteSceneHeader(
	ctx context.Context,
	campaignID, sceneID, gmUserID uuid.UUID,
) error {
	// Verify GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: pgtype.UUID{Bytes: campaignID, Valid: true},
		UserID:     pgtype.UUID{Bytes: gmUserID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to verify GM status: %w", err)
	}
	if !isGM {
		return ErrNotGM
	}

	// Get scene to find current header URL
	scene, err := s.queries.GetScene(ctx, pgtype.UUID{Bytes: sceneID, Valid: true})
	if err != nil {
		return fmt.Errorf("scene not found: %w", err)
	}

	if !scene.HeaderImageUrl.Valid || scene.HeaderImageUrl.String == "" {
		return nil // No header to delete
	}

	// Delete from storage
	path := fmt.Sprintf(
		"campaigns/%s/scenes/%s",
		campaignID,
		filepath.Base(scene.HeaderImageUrl.String),
	)
	fileSize, _ := s.storage.GetFileSize(ctx, StorageBucket, path)

	if deleteErr := s.storage.Delete(ctx, StorageBucket, path); deleteErr != nil {
		// Intentionally ignoring storage delete errors
		_ = deleteErr
	}

	// Clear header URL
	_, err = s.queries.ClearSceneHeaderImage(ctx, pgtype.UUID{Bytes: sceneID, Valid: true})
	if err != nil {
		return fmt.Errorf("failed to clear scene header: %w", err)
	}

	// Update campaign storage
	if fileSize > 0 {
		_, _ = s.queries.DecrementCampaignStorage(ctx, generated.DecrementCampaignStorageParams{
			ID:               pgtype.UUID{Bytes: campaignID, Valid: true},
			StorageUsedBytes: fileSize,
		})
	}

	return nil
}

// DeleteSceneHeaderByURL deletes a scene header image from storage given its URL.
// This is used when deleting a scene to clean up its header image.
// Errors are intentionally ignored since the scene is already deleted.
func (s *ImageService) DeleteSceneHeaderByURL(
	ctx context.Context,
	campaignID uuid.UUID,
	headerImageURL string,
) {
	if headerImageURL == "" {
		return
	}

	// Delete from storage
	path := fmt.Sprintf(
		"campaigns/%s/scenes/%s",
		campaignID,
		filepath.Base(headerImageURL),
	)
	fileSize, _ := s.storage.GetFileSize(ctx, StorageBucket, path)

	if deleteErr := s.storage.Delete(ctx, StorageBucket, path); deleteErr != nil {
		// Intentionally ignoring storage delete errors
		_ = deleteErr
	}

	// Update campaign storage
	if fileSize > 0 {
		_, _ = s.queries.DecrementCampaignStorage(ctx, generated.DecrementCampaignStorageParams{
			ID:               pgtype.UUID{Bytes: campaignID, Valid: true},
			StorageUsedBytes: fileSize,
		})
	}
}

// validateAndUpload validates the image and uploads it to storage.
func (s *ImageService) validateAndUpload(
	ctx context.Context,
	campaignID uuid.UUID,
	file multipart.File,
	header *multipart.FileHeader,
	folder, filename string,
) (string, int64, error) {
	// Check file size
	if header.Size > MaxFileSize {
		return "", 0, ErrFileTooLarge
	}

	// Check campaign storage
	campaign, err := s.queries.GetCampaign(ctx, pgtype.UUID{Bytes: campaignID, Valid: true})
	if err != nil {
		return "", 0, fmt.Errorf("failed to get campaign: %w", err)
	}
	if campaign.StorageUsedBytes+header.Size > StorageLimit {
		return "", 0, ErrStorageLimitReached
	}

	// Read file content
	fileContent, err := io.ReadAll(file)
	if err != nil {
		return "", 0, fmt.Errorf("failed to read file: %w", err)
	}

	// Decode image to validate
	img, format, err := image.Decode(bytes.NewReader(fileContent))
	if err != nil {
		return "", 0, ErrInvalidFormat
	}

	// Validate format
	format = strings.ToLower(format)
	if format != "png" && format != imageFormatJPEG && format != "webp" {
		return "", 0, ErrInvalidFormat
	}

	// Check dimensions
	bounds := img.Bounds()
	if bounds.Dx() > MaxDimension || bounds.Dy() > MaxDimension {
		return "", 0, ErrImageTooLarge
	}

	// Determine content type
	contentType := "image/" + format
	if format == imageFormatJPEG {
		contentType = "image/jpeg"
	}

	// Determine extension
	ext := format
	if format == imageFormatJPEG {
		ext = "jpg"
	}

	// Upload to storage
	path := fmt.Sprintf("campaigns/%s/%s/%s.%s", campaignID, folder, filename, ext)
	url, err := s.storage.Upload(
		ctx,
		StorageBucket,
		path,
		contentType,
		bytes.NewReader(fileContent),
	)
	if err != nil {
		return "", 0, fmt.Errorf("failed to upload: %w", err)
	}

	return url, header.Size, nil
}
