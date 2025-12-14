package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const (
	listFilesLimit = 1000
)

// Client handles Supabase Storage operations.
type Client struct {
	supabaseURL    string
	serviceRoleKey string
	httpClient     *http.Client
}

// NewClient creates a new storage client.
func NewClient(supabaseURL, serviceRoleKey string) *Client {
	return &Client{
		supabaseURL:    strings.TrimSuffix(supabaseURL, "/"),
		serviceRoleKey: serviceRoleKey,
		httpClient:     &http.Client{},
	}
}

// UploadResponse represents the response from a successful upload.
type UploadResponse struct {
	Key string `json:"Key"`
}

// Upload uploads a file to Supabase Storage.
func (c *Client) Upload(ctx context.Context, bucket, path, contentType string, data io.Reader) (string, error) {
	// Read all data into a buffer for content-length
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, data); err != nil {
		return "", fmt.Errorf("failed to read file data: %w", err)
	}

	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.supabaseURL, bucket, path)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, buf)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Upsert", "true") // Allow overwrite

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to upload: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("upload failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Return public URL
	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", c.supabaseURL, bucket, path)
	return publicURL, nil
}

// Delete deletes a file from Supabase Storage.
func (c *Client) Delete(ctx context.Context, bucket, path string) error {
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.supabaseURL, bucket, path)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK &&
		resp.StatusCode != http.StatusNoContent &&
		resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetFileSize returns the size of a file in bytes, or 0 if not found.
func (c *Client) GetFileSize(ctx context.Context, bucket, path string) (int64, error) {
	reqURL := fmt.Sprintf("%s/storage/v1/object/info/%s/%s", c.supabaseURL, bucket, path)

	req, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if reqErr != nil {
		return 0, fmt.Errorf("failed to create request: %w", reqErr)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)

	resp, respErr := c.httpClient.Do(req)
	if respErr != nil {
		return 0, fmt.Errorf("failed to get file info: %w", respErr)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return 0, nil
	}

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("get file info failed with status %d", resp.StatusCode)
	}

	var info struct {
		Size int64 `json:"size"`
	}
	if decodeErr := json.NewDecoder(resp.Body).Decode(&info); decodeErr != nil {
		return 0, fmt.Errorf("failed to decode file info: %w", decodeErr)
	}

	return info.Size, nil
}

// ListFiles lists files in a bucket with a prefix.
func (c *Client) ListFiles(ctx context.Context, bucket, prefix string) ([]string, error) {
	url := fmt.Sprintf("%s/storage/v1/object/list/%s", c.supabaseURL, bucket)

	body := map[string]interface{}{
		"prefix": prefix,
		"limit":  listFilesLimit,
	}
	bodyJSON, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list files: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("list files failed with status %d", resp.StatusCode)
	}

	var files []struct {
		Name string `json:"name"`
	}
	if decodeErr := json.NewDecoder(resp.Body).Decode(&files); decodeErr != nil {
		return nil, fmt.Errorf("failed to decode file list: %w", decodeErr)
	}

	result := make([]string, len(files))
	for i, f := range files {
		result[i] = f.Name
	}
	return result, nil
}
