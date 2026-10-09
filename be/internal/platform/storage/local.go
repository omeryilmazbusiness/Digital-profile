package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// contentTypeSuffix stores each object's content type in a sidecar file, keeping objects
// themselves byte-identical to what was uploaded.
const contentTypeSuffix = ".content-type"

// Local stores objects as files below a root directory. os.Root confines every operation to
// that directory, so even a key that slipped past validation cannot escape it.
type Local struct {
	root *os.Root
	dir  string
}

// NewLocal opens (creating if needed) dir as the storage root.
func NewLocal(dir string) (*Local, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("storage: create %s: %w", dir, err)
	}
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, fmt.Errorf("storage: open %s: %w", dir, err)
	}
	return &Local{root: root, dir: dir}, nil
}

func (l *Local) Close() error { return l.root.Close() }

func (l *Local) Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) error {
	if err := checkKey(key); err != nil {
		return err
	}
	if strings.HasSuffix(key, contentTypeSuffix) {
		return fmt.Errorf("storage: key %q uses a reserved suffix", key)
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if dir := filepath.Dir(filepath.FromSlash(key)); dir != "." {
		if err := l.root.MkdirAll(dir, 0o750); err != nil {
			return fmt.Errorf("storage: mkdir: %w", err)
		}
	}

	// Write to a temporary sibling and rename, so readers never see a partial file.
	tmp := filepath.FromSlash(key) + ".tmp-" + randomSuffix()
	f, err := l.root.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o640)
	if err != nil {
		return fmt.Errorf("storage: create: %w", err)
	}
	cleanup := func() { _ = l.root.Remove(tmp) }

	n, err := io.Copy(f, r)
	if err == nil && size >= 0 && n != size {
		err = fmt.Errorf("storage: wrote %d bytes, expected %d", n, size)
	}
	if err == nil {
		err = f.Sync()
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		cleanup()
		return err
	}
	if err := l.writeContentType(key, contentType); err != nil {
		cleanup()
		return err
	}
	if err := l.root.Rename(tmp, filepath.FromSlash(key)); err != nil {
		cleanup()
		return fmt.Errorf("storage: rename: %w", err)
	}
	return nil
}

func (l *Local) writeContentType(key, contentType string) error {
	name := filepath.FromSlash(key) + contentTypeSuffix
	f, err := l.root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o640)
	if err != nil {
		return fmt.Errorf("storage: write content type: %w", err)
	}
	_, err = f.WriteString(contentType)
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	return err
}

func (l *Local) Get(ctx context.Context, key string) (io.ReadCloser, Object, error) {
	obj, err := l.Stat(ctx, key)
	if err != nil {
		return nil, Object{}, err
	}
	f, err := l.root.Open(filepath.FromSlash(key))
	if err != nil {
		return nil, Object{}, mapFSError(err)
	}
	return f, obj, nil
}

func (l *Local) Stat(ctx context.Context, key string) (Object, error) {
	if err := checkKey(key); err != nil {
		return Object{}, err
	}
	if err := ctx.Err(); err != nil {
		return Object{}, err
	}
	info, err := l.root.Stat(filepath.FromSlash(key))
	if err != nil {
		return Object{}, mapFSError(err)
	}
	if !info.Mode().IsRegular() {
		return Object{}, ErrNotFound
	}
	ct := "application/octet-stream"
	if b, err := l.root.ReadFile(filepath.FromSlash(key) + contentTypeSuffix); err == nil && len(b) > 0 {
		ct = string(b)
	}
	return Object{Size: info.Size(), ContentType: ct, ModTime: info.ModTime()}, nil
}

func (l *Local) Delete(ctx context.Context, key string) error {
	if err := checkKey(key); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	name := filepath.FromSlash(key)
	if err := l.root.Remove(name); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("storage: delete: %w", err)
	}
	if err := l.root.Remove(name + contentTypeSuffix); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("storage: delete: %w", err)
	}
	return nil
}

// Ping checks the root is still a writable directory.
func (l *Local) Ping(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	name := ".ping-" + randomSuffix()
	f, err := l.root.Create(name)
	if err != nil {
		return fmt.Errorf("storage: %s is not writable: %w", l.dir, err)
	}
	_ = f.Close()
	return l.root.Remove(name)
}

func mapFSError(err error) error {
	if errors.Is(err, fs.ErrNotExist) {
		return ErrNotFound
	}
	return fmt.Errorf("storage: %w", err)
}
