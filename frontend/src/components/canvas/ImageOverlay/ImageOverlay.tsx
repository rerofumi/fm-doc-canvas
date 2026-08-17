import React from "react";
import { useTranslation } from "react-i18next";

interface ImageOverlayProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const ImageOverlay: React.FC<ImageOverlayProps> = ({ src, alt, onClose }) => {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="flex items-center justify-center max-w-full max-h-full">
        <img
          src={src}
          alt={alt || t(($) => $.canvas.overlayImage)}
          className="max-w-[90vw] max-h-[90vh] object-contain"
        />
      </div>
    </div>
  );
};

export default ImageOverlay;
