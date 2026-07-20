export const SUPPORTED_MEDIA_ACCEPT =
  ".mp4,.jpg,.jpeg,.png,video/mp4,image/jpeg,image/png";

export const isVideoFile = (file: File | null) =>
  Boolean(
    file &&
      (file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".mp4")),
  );

export const isSupportedMediaFile = (file: File) => {
  const name = file.name.toLowerCase();

  return (
    file.type === "video/mp4" ||
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    name.endsWith(".mp4") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png")
  );
};
