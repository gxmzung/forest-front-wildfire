import { describe, it, expect } from 'vitest';
import { publishVehicleWeatherTarget, subscribeVehicleWeatherTarget } from './vehicleWeatherTarget';
describe('actual weather target bridge', () => {
 it('keeps the latest location across tab mounts, isolates copies and rejects invalid locations', () => {
  publishVehicleWeatherTarget({ latitude: 36.4, longitude: 127.3 });
  const received: {latitude:number;longitude:number}[] = [];
  const off = subscribeVehicleWeatherTarget((target) => { received.push({...target}); target.latitude = 0; });
  expect(received).toEqual([{latitude:36.4,longitude:127.3}]);
  publishVehicleWeatherTarget({ latitude: NaN, longitude: 127 });
  expect(received).toHaveLength(1);
  off(); publishVehicleWeatherTarget({latitude:35.8,longitude:128.1});
  expect(received).toHaveLength(1);
  const again: object[] = []; const stop = subscribeVehicleWeatherTarget((target)=>again.push(target));
  expect(again).toEqual([{latitude:35.8,longitude:128.1}]); stop();
 });
});
