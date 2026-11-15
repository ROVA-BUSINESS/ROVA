import React from 'react';

// Exact base64 image derived directly from the user's uploaded icon
const WHATSAPP_ICON_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAtCAYAAAADfVPBAAAB6ElEQVR4nO2Wz2cDQRTH+2+UUkIIoYQQQgglp5JTTj2FHirVak8lp15zDaGUnEooofRUci2l5BQaPUQOoVRL9VB6+tbwpl7GZncm3dm9vA855M378X07u29mY0MQBEGIAEAeQBfAHMvMAAwA7KetMRIAJQBj2NNKW3MgAPqGUPW/DiBL6zkADdoZzjBt7UsAeGbiDi1j2izmwb9KCwBcM1EFx9gyi730p9JdTGnNHE2Woxi/SnshLySiw2wNst055BlRzNib2AgBBf04DTuC7Bb5NJnYxVoU71HxLrNVjUnVdsinp+GFN9EhxfV5Uma2nNHMsUO+E4q59yY6pPiCim8Z9i+yLxzzVShuErtYi+KfVHzTsO+ynak45MtQzNyL4Ijis1WC6V6m+FGvnrEWOH7ZziR/gAK4peIHK9YfzUHAvot387IJ4IjW+kn1wIu3qPgoxOcG4RSZr26+nlgThlhNNsSnuaIRMJ+8aUscdi8bWPhW6cY8pbFeYWtTypP8GcNEdEhE7x859LB4i1edu5AJCamtGc9v3NvxK3QT8/ee0/minvIw7Bsi3xqAb9aI9XnkBQB7EZPqSX0DanST7yndvz6YjzqHdlJthJq5ChB/Tr/XiEbVOXOWdg+CIAiCIAiCIAhCjPwC4s+K4J3aXdsAAAAASUVORK5CYII=";

interface WhatsAppIconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function WhatsAppIcon({
  size = 20,
  className = '',
  style,
}: WhatsAppIconProps) {
  return (
    <img
      src={WHATSAPP_ICON_BASE64}
      alt="WhatsApp"
      width={size}
      height={size}
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        width: size,
        height: size,
        objectFit: 'contain',
        filter: 'brightness(1.1)',
        ...style,
      }}
    />
  );
}
