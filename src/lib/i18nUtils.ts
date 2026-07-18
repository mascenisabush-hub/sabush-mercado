import i18n from '../i18n';

export function getTranslatedField<T>(
  data: any,
  field: string,
  defaultValue: T
): T {
  const currentLang = i18n.language;
  
  if (data?.translations?.[currentLang]?.[field]) {
    return data.translations[currentLang][field];
  }
  
  return data?.[field] ?? defaultValue;
}
