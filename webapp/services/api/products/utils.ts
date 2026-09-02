export function toFormData(data: Record<string, any>, files: Record<string, File> = {}) {
    const fd = new FormData();
  
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        fd.append(key, String(value));
      }
    }
  
    for (const [key, file] of Object.entries(files)) {
      fd.append(key, file);
    }
  
    return fd;
  }
  