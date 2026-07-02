import React, { useRef, useState } from 'react';
import { Upload, Image, message } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadChangeParam, UploadFile } from 'antd/es/upload/interface';

interface ImageUploaderProps {
  /** Current image URL value (controlled) */
  value?: string;
  /** Callback when image URL changes */
  onChange?: (url: string) => void;
  /** API endpoint for upload action */
  action?: string;
  /** Max file size in bytes (default 5MB) */
  maxSize?: number;
  /** Width of the preview area */
  width?: number;
  /** Height of the preview area */
  height?: number;
  /** Custom upload handler (if set, overrides action) */
  customUploadHandler?: (file: File) => Promise<string>;
  /** Disabled state */
  disabled?: boolean;
}

export default function ImageUploader({
  value,
  onChange,
  action,
  maxSize = 5 * 1024 * 1024,
  width = 80,
  height = 80,
  customUploadHandler,
  disabled = false,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      message.error('请选择图片文件');
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      message.error(`文件大小不能超过 ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
      return;
    }

    setUploading(true);

    try {
      let url: string;

      if (customUploadHandler) {
        url = await customUploadHandler(file);
      } else if (action) {
        // Use Ant Design Upload action
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(action, { method: 'POST', body: formData });
        const data = await res.json();
        url = data.url || data.data?.url || '';
      } else {
        // Default: base64 upload via FileReader + api call
        const reader = new FileReader();
        const base64: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        // Dynamic import api to avoid circular dependency at module level
        const api = (await import('../api')).default;
        const { data } = await api.post('/products/upload-image', { image: base64 });
        url = data.url;
      }

      onChange?.(url);
      message.success('图片上传成功');
    } catch {
      message.error('图片上传失败');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      e.target.value = '';
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
  };

  return (
    <div>
      <div
        style={{
          width,
          height,
          borderRadius: 8,
          overflow: 'hidden',
          background: '#f5f5f5',
          border: '1px dashed #d9d9d9',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          opacity: disabled ? 0.6 : 1,
        }}
        onClick={handleClick}
      >
        {uploading ? (
          <LoadingOutlined style={{ fontSize: 24, color: '#999' }} />
        ) : value ? (
          <>
            <img
              src={value}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {!disabled && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  background: 'rgba(0,0,0,0.45)',
                  color: '#fff',
                  fontSize: 12,
                  padding: '1px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onClick={handleRemove}
              >
                X
              </span>
            )}
          </>
        ) : (
          <PlusOutlined style={{ fontSize: 24, color: '#ccc' }} />
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
