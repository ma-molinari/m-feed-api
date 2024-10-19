enum MIME_TYPE {
  jpg = "image/jpeg",
  jpeg = "image/jpeg",
  png = "image/png",
  webp = "image/webp",
}

interface GetFileProps {
  Params: {
    filename: string;
  };
}

export { MIME_TYPE, GetFileProps };
