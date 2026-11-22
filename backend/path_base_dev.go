//go:build dev

package backend

import (
	"os"
	"path/filepath"
)

func defaultBaseDir() (string, error) {
	if wd, err := os.Getwd(); err == nil && wd != "" {
		return wd, nil
	}
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(exe), nil
}
