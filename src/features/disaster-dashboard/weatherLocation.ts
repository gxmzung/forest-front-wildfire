/** Browser location is permission based and may be Wi-Fi/IP rather than GNSS. */
export function requestWeatherLocation(geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined, secure: boolean): Promise<GeolocationPosition> {
  if (!secure) return Promise.reject(new Error("현재 위치는 HTTPS 또는 localhost에서 사용할 수 있습니다."));
  if (!geolocation) return Promise.reject(new Error("이 브라우저는 현재 위치 확인을 지원하지 않습니다. 좌표를 직접 입력하세요."));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition((position) => {
      const { latitude, longitude, accuracy } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 31 || latitude > 44 || longitude < 123 || longitude > 133 || !Number.isFinite(accuracy) || accuracy < 0 || !Number.isFinite(position.timestamp)) {
        reject(new Error("국내 조회 범위의 유효한 위치를 확인하지 못했습니다. 좌표를 직접 입력하세요."));
        return;
      }
      resolve(position);
    }, (error) => {
      reject(new Error(error.code === 1 ? "위치 권한이 거부되었거나 사이트 정책에서 차단되었습니다. 브라우저의 위치 권한을 확인하세요." : error.code === 3 ? "현재 위치 확인 시간이 초과되었습니다. 다시 시도하거나 좌표를 입력하세요." : "기기의 위치를 확인하지 못했습니다. 좌표를 직접 입력하세요."));
    }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  });
}
