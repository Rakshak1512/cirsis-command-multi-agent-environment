export function generateRouteCoordinates(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  steps: number = 8
): [number, number][] {
  const coords: [number, number][] = [];
  const midLat = (startLat + destLat) / 2;
  const midLng = (startLng + destLng) / 2;
  const offset = 0.0015;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let lat: number;
    let lng: number;
    if (t < 0.5) {
      const s = t * 2;
      lat = startLat + s * (midLat + offset - startLat);
      lng = startLng + s * (midLng - offset - startLng);
    } else {
      const s = (t - 0.5) * 2;
      lat = (midLat + offset) + s * (destLat - (midLat + offset));
      lng = (midLng - offset) + s * (destLng - (midLng - offset));
    }
    coords.push([lat, lng]);
  }
  return coords;
}
