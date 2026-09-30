import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildTerrainAnalysis,
  calculateSlopeDegrees,
  lineOfSightBlocked,
  offsetCoordinate,
} from "./terrainAnalysis";

describe(
  "DEM-03 slope calculation",
  () => {
    it(
      "평탄면 경사각은 0도다",
      () => {
        expect(
          calculateSlopeDegrees(
            100,
            100,
            100,
            100,
            90,
          ),
        ).toBeCloseTo(
          0,
          6,
        );
      },
    );

    it(
      "동서 고도차로 실제 경사각을 계산한다",
      () => {
        const slope =
          calculateSlopeDegrees(
            90,
            110,
            100,
            100,
            100,
          );

        expect(
          slope,
        ).toBeGreaterThan(
          5,
        );

        expect(
          slope,
        ).toBeLessThan(
          6,
        );
      },
    );

    it(
      "미터 offset을 위경도 좌표로 변환한다",
      () => {
        const point =
          offsetCoordinate(
            127,
            36,
            100,
            100,
          );

        expect(
          point[0],
        ).toBeGreaterThan(
          127,
        );

        expect(
          point[1],
        ).toBeGreaterThan(
          36,
        );
      },
    );
  },
);

describe(
  "DEM-05 terrain line of sight",
  () => {
    it(
      "중간 지형이 시선보다 낮으면 가시권이다",
      () => {
        const result =
          lineOfSightBlocked({
            from:
              [127, 36],

            to:
              [127.01, 36],

            fromAltitudeM:
              120,

            toAltitudeM:
              110,

            elevationAt:
              () => 80,

            samples:
              8,
          });

        expect(
          result.blocked,
        ).toBe(false);

        expect(
          result.validSamples,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "능선이 시선을 넘으면 통신 음영으로 판정한다",
      () => {
        const result =
          lineOfSightBlocked({
            from:
              [127, 36],

            to:
              [127.01, 36],

            fromAltitudeM:
              110,

            toAltitudeM:
              105,

            elevationAt:
              (
                longitude,
              ) =>
                longitude >
                  127.004 &&
                longitude <
                  127.006
                  ? 140
                  : 80,

            samples:
              10,

            clearanceM:
              1,
          });

        expect(
          result.blocked,
        ).toBe(true);
      },
    );

    it(
      "DEM grid에서 slope/viewshed/shadow를 동시에 생성한다",
      () => {
        const center:
          [number, number] =
          [127, 36];

        const elevationAt = (
          longitude: number,
          latitude: number,
        ) => {
          const east =
            (
              longitude -
              center[0]
            ) *
            90_000;

          const north =
            (
              latitude -
              center[1]
            ) *
            111_000;

          /*
           * 동쪽 능선으로
           * slope와 shadow를 만든다.
           */
          const ridge =
            east > 150 &&
            east < 350
              ? 160
              : 0;

          return (
            100 +
            east * 0.05 +
            north * 0.02 +
            ridge
          );
        };

        const result =
          buildTerrainAnalysis({
            center,

            radiusM:
              600,

            cellSizeM:
              120,

            elevationAt,

            observer: {
              id:
                "RELAY-TEST",

              longitude:
                center[0],

              latitude:
                center[1],

              altitudeM:
                125,
            },

            losSamples:
              10,
          });

        expect(
          result.sampledCells,
        ).toBeGreaterThan(
          20,
        );

        expect(
          result.slopeCells,
        ).toBe(
          result.sampledCells,
        );

        expect(
          result.maxSlopeDeg,
        ).not.toBeNull();

        expect(
          result.viewshedCells,
        ).toBeGreaterThan(
          0,
        );

        expect(
          result.shadowCells,
        ).toBeGreaterThan(
          0,
        );
      },
    );
  },
);
