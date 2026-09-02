export function toQueryString(params: Record<string, any>) {
    const query = new URLSearchParams();
  
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
  
      query.append(key, String(value));
    });
  
    const qs = query.toString();
    return qs ? `?${qs}` : "";
  }
  