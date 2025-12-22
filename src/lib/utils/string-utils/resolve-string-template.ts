// Custom implementation to avoid external dependency
const isEmptyObject = (obj: unknown): boolean => {
  return obj !== null && typeof obj === 'object' && Object.keys(obj).length === 0;
};

export const resolveStringTemplate = (str: string, obj?: StringKV) => {
  if (!obj || isEmptyObject(obj)) return str;
  return str.replace(/\${(.*?)}/g, (x, g: string) => obj[g]);
};
