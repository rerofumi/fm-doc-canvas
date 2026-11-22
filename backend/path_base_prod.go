//go:build !dev

package backend

import (
	"os"
	"path/filepath"
)

func defaultBaseDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(exe), nil
}
