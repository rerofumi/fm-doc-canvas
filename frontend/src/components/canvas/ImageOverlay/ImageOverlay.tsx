import React from "react";

interface ImageOverlayProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const ImageOverlay: React.FC<ImageOverlayProps> = ({ src, alt, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="flex items-center justify-center max-w-full max-h-full">
        <img
          src={src}
          alt={alt || "Overlay image"}
          className="max-w-[90vw] max-h-[90vh] object-contain"
        />
      </div>
    </div>
  );
};

export default ImageOverlay;
