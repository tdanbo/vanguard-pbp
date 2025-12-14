package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/models"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
)

// ImageHandler handles image upload endpoints.
type ImageHandler struct {
	imageService *service.ImageService
}

// NewImageHandler creates a new image handler.
func NewImageHandler(imageService *service.ImageService) *ImageHandler {
	return &ImageHandler{imageService: imageService}
}

// GetStorageStatus returns the storage quota status for a campaign.
func (h *ImageHandler) GetStorageStatus(c *gin.Context) {
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		models.ValidationError(c, "Invalid campaign ID")
		return
	}

	status, err := h.imageService.GetStorageStatus(c.Request.Context(), campaignID)
	if err != nil {
		models.InternalError(c)
		return
	}

	c.JSON(http.StatusOK, status)
}

// UploadAvatar uploads an avatar image for a character.
//
//nolint:dupl // Handler patterns are intentionally similar across resources
func (h *ImageHandler) UploadAvatar(c *gin.Context) {
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		models.ValidationError(c, "Invalid campaign ID")
		return
	}

	characterID, err := uuid.Parse(c.Param("characterId"))
	if err != nil {
		models.ValidationError(c, "Invalid character ID")
		return
	}

	userIDStr, ok := middleware.GetUserID(c)
	if !ok {
		models.UnauthorizedError(c)
		return
	}
	gmUserID, err := uuid.Parse(userIDStr)
	if err != nil {
		models.UnauthorizedError(c)
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		models.ValidationError(c, "No file provided")
		return
	}
	defer func() { _ = file.Close() }()

	url, uploadErr := h.imageService.UploadAvatar(c.Request.Context(), campaignID, characterID, gmUserID, file, header)
	if uploadErr != nil {
		handleImageError(c, uploadErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{"url": url})
}

// DeleteAvatar deletes an avatar image for a character.
func (h *ImageHandler) DeleteAvatar(c *gin.Context) {
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		models.ValidationError(c, "Invalid campaign ID")
		return
	}

	characterID, err := uuid.Parse(c.Param("characterId"))
	if err != nil {
		models.ValidationError(c, "Invalid character ID")
		return
	}

	userIDStr, ok := middleware.GetUserID(c)
	if !ok {
		models.UnauthorizedError(c)
		return
	}
	gmUserID, err := uuid.Parse(userIDStr)
	if err != nil {
		models.UnauthorizedError(c)
		return
	}

	err = h.imageService.DeleteAvatar(c.Request.Context(), campaignID, characterID, gmUserID)
	if err != nil {
		handleImageError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Avatar deleted"})
}

// UploadSceneHeader uploads a header image for a scene.
//
//nolint:dupl // Handler patterns are intentionally similar across resources
func (h *ImageHandler) UploadSceneHeader(c *gin.Context) {
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		models.ValidationError(c, "Invalid campaign ID")
		return
	}

	sceneID, err := uuid.Parse(c.Param("sceneId"))
	if err != nil {
		models.ValidationError(c, "Invalid scene ID")
		return
	}

	userIDStr, ok := middleware.GetUserID(c)
	if !ok {
		models.UnauthorizedError(c)
		return
	}
	gmUserID, err := uuid.Parse(userIDStr)
	if err != nil {
		models.UnauthorizedError(c)
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		models.ValidationError(c, "No file provided")
		return
	}
	defer func() { _ = file.Close() }()

	url, uploadErr := h.imageService.UploadSceneHeader(c.Request.Context(), campaignID, sceneID, gmUserID, file, header)
	if uploadErr != nil {
		handleImageError(c, uploadErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{"url": url})
}

// DeleteSceneHeader deletes a header image for a scene.
func (h *ImageHandler) DeleteSceneHeader(c *gin.Context) {
	campaignID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		models.ValidationError(c, "Invalid campaign ID")
		return
	}

	sceneID, err := uuid.Parse(c.Param("sceneId"))
	if err != nil {
		models.ValidationError(c, "Invalid scene ID")
		return
	}

	userIDStr, ok := middleware.GetUserID(c)
	if !ok {
		models.UnauthorizedError(c)
		return
	}
	gmUserID, err := uuid.Parse(userIDStr)
	if err != nil {
		models.UnauthorizedError(c)
		return
	}

	err = h.imageService.DeleteSceneHeader(c.Request.Context(), campaignID, sceneID, gmUserID)
	if err != nil {
		handleImageError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Scene header deleted"})
}

func handleImageError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrNotGM):
		models.RespondError(c, http.StatusForbidden, models.NewAPIError("NOT_GM", "Only the GM can upload images"))
	case errors.Is(err, service.ErrFileTooLarge):
		models.RespondError(c, http.StatusBadRequest, models.NewAPIError("FILE_TOO_LARGE", err.Error()))
	case errors.Is(err, service.ErrImageTooLarge):
		models.RespondError(c, http.StatusBadRequest, models.NewAPIError("IMAGE_TOO_LARGE", err.Error()))
	case errors.Is(err, service.ErrInvalidFormat):
		models.RespondError(c, http.StatusBadRequest, models.NewAPIError("INVALID_FORMAT", err.Error()))
	case errors.Is(err, service.ErrStorageLimitReached):
		models.RespondError(c, http.StatusBadRequest, models.NewAPIError("STORAGE_LIMIT_REACHED", err.Error()))
	default:
		models.InternalError(c)
	}
}
