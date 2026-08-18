/**
 * Google Plus Code (Open Location Code) encoder.
 * Port of https://github.com/google/open-location-code (Apache-2.0).
 * Encodes lat/lng offline — no Maps API key.
 */

const ALPHABET = '23456789CFGHJMPQRVWX';
const SEPARATOR = '+';
const SEPARATOR_POSITION = 8;
const PAIR_CODE_LENGTH = 10;
const MAX_DIGIT_COUNT = 15;
const MIN_DIGIT_COUNT = 2;
const ENCODING_BASE = ALPHABET.length;
const GRID_ROWS = 5;
const GRID_COLUMNS = 4;
const GRID_CODE_LENGTH = MAX_DIGIT_COUNT - PAIR_CODE_LENGTH;
const LATITUDE_MAX = 90;
const LONGITUDE_MAX = 180;
const PAIR_PRECISION = ENCODING_BASE ** 3;
const FINAL_LAT_PRECISION = PAIR_PRECISION * GRID_ROWS ** GRID_CODE_LENGTH;
const FINAL_LNG_PRECISION = PAIR_PRECISION * GRID_COLUMNS ** GRID_CODE_LENGTH;

/** 11-character code is ~3m — better for re-checking a phone GPS punch. */
export const PLUS_CODE_LENGTH = 11;

function locationToIntegers(latitude: number, longitude: number): [number, number] {
  let latVal = Math.floor(latitude * FINAL_LAT_PRECISION);
  latVal += LATITUDE_MAX * FINAL_LAT_PRECISION;
  if (latVal < 0) latVal = 0;
  else if (latVal >= 2 * LATITUDE_MAX * FINAL_LAT_PRECISION) {
    latVal = 2 * LATITUDE_MAX * FINAL_LAT_PRECISION - 1;
  }

  let lngVal = Math.floor(longitude * FINAL_LNG_PRECISION);
  lngVal += LONGITUDE_MAX * FINAL_LNG_PRECISION;
  if (lngVal < 0) {
    lngVal =
      (lngVal % (2 * LONGITUDE_MAX * FINAL_LNG_PRECISION)) +
      2 * LONGITUDE_MAX * FINAL_LNG_PRECISION;
  } else if (lngVal >= 2 * LONGITUDE_MAX * FINAL_LNG_PRECISION) {
    lngVal %= 2 * LONGITUDE_MAX * FINAL_LNG_PRECISION;
  }
  return [latVal, lngVal];
}

export function encodePlusCode(
  latitude: number,
  longitude: number,
  codeLength = PLUS_CODE_LENGTH,
): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';

  let length = Math.min(MAX_DIGIT_COUNT, codeLength);
  if (length < MIN_DIGIT_COUNT || (length < PAIR_CODE_LENGTH && length % 2 === 1)) {
    length = PLUS_CODE_LENGTH;
  }

  let [latInt, lngInt] = locationToIntegers(latitude, longitude);
  const code: string[] = new Array(MAX_DIGIT_COUNT + 1);
  code[SEPARATOR_POSITION] = SEPARATOR;

  if (length > PAIR_CODE_LENGTH) {
    for (let i = MAX_DIGIT_COUNT - PAIR_CODE_LENGTH; i >= 1; i--) {
      const latDigit = latInt % GRID_ROWS;
      const lngDigit = lngInt % GRID_COLUMNS;
      code[SEPARATOR_POSITION + 2 + i] = ALPHABET.charAt(latDigit * GRID_COLUMNS + lngDigit);
      latInt = Math.floor(latInt / GRID_ROWS);
      lngInt = Math.floor(lngInt / GRID_COLUMNS);
    }
  } else {
    latInt = Math.floor(latInt / GRID_ROWS ** GRID_CODE_LENGTH);
    lngInt = Math.floor(lngInt / GRID_COLUMNS ** GRID_CODE_LENGTH);
  }

  code[SEPARATOR_POSITION + 1] = ALPHABET.charAt(latInt % ENCODING_BASE);
  code[SEPARATOR_POSITION + 2] = ALPHABET.charAt(lngInt % ENCODING_BASE);
  latInt = Math.floor(latInt / ENCODING_BASE);
  lngInt = Math.floor(lngInt / ENCODING_BASE);

  for (let i = PAIR_CODE_LENGTH / 2 + 1; i >= 0; i -= 2) {
    code[i] = ALPHABET.charAt(latInt % ENCODING_BASE);
    code[i + 1] = ALPHABET.charAt(lngInt % ENCODING_BASE);
    latInt = Math.floor(latInt / ENCODING_BASE);
    lngInt = Math.floor(lngInt / ENCODING_BASE);
  }

  return code.slice(0, length + 1).join('');
}

export function googleMapsUrl(plusCode: string, lat?: number, lng?: number): string {
  const query = plusCode || (lat != null && lng != null ? `${lat},${lng}` : '');
  if (!query) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
