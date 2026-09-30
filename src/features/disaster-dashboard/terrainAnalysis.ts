export type ElevationSampler = (
  longitude: number,
  latitude: number,
) => number | null;

export type TerrainObserver = {
  id: string;

  longitude: number;

  latitude: number;

  /*
   * 절대고도(해발고도)가 있으면 사용.
   * 없거나 DEM 지표보다 낮으면
   * heightAboveGroundM를 사용한다.
   */
  altitudeM?:
    number | null;

  heightAboveGroundM?:
    number;
};

export type TerrainAnalysisOptions = {
  center:
    [number, number];

  radiusM:
    number;

  cellSizeM:
    number;

  elevationAt:
    ElevationSampler;

  observer:
    TerrainObserver;

  slopeWarningDeg?:
    number;

  losSamples?:
    number;

  targetHeightAboveGroundM?:
    number;

  clearanceM?:
    number;
};

export type TerrainAnalysisResult = {
  source:
    "RASTER_DEM";

  calculatedAt:
    string;

  observerId:
    string;

  sampledCells:
    number;

  missingCells:
    number;

  slopeCells:
    number;

  steepCells:
    number;

  maxSlopeDeg:
    number | null;

  viewshedCells:
    number;

  shadowCells:
    number;

  slopeGeoJson:
    GeoJSON.FeatureCollection;

  viewshedGeoJson:
    GeoJSON.FeatureCollection;

  shadowGeoJson:
    GeoJSON.FeatureCollection;
};

const EARTH_RADIUS_M =
  6_378_137;

function toRadians(
  degrees: number,
) {
  return (
    degrees *
    Math.PI /
    180
  );
}

function toDegrees(
  radians: number,
) {
  return (
    radians *
    180 /
    Math.PI
  );
}

export function offsetCoordinate(
  longitude: number,
  latitude: number,
  eastM: number,
  northM: number,
): [number, number] {
  const latitudeRad =
    toRadians(latitude);

  const deltaLatitude =
    northM /
    EARTH_RADIUS_M;

  const deltaLongitude =
    eastM /
    (
      EARTH_RADIUS_M *
      Math.max(
        0.01,
        Math.cos(
          latitudeRad,
        ),
      )
    );

  return [
    longitude +
      toDegrees(
        deltaLongitude,
      ),

    latitude +
      toDegrees(
        deltaLatitude,
      ),
  ];
}

export function calculateSlopeDegrees(
  westElevationM: number,
  eastElevationM: number,
  southElevationM: number,
  northElevationM: number,
  sampleSpacingM: number,
) {
  if (
    sampleSpacingM <= 0
  ) {
    return 0;
  }

  const dzDx =
    (
      eastElevationM -
      westElevationM
    ) /
    (
      2 *
      sampleSpacingM
    );

  const dzDy =
    (
      northElevationM -
      southElevationM
    ) /
    (
      2 *
      sampleSpacingM
    );

  const gradient =
    Math.hypot(
      dzDx,
      dzDy,
    );

  return (
    Math.atan(
      gradient,
    ) *
    180 /
    Math.PI
  );
}

function safeElevation(
  elevationAt:
    ElevationSampler,
  coordinate:
    [number, number],
) {
  const elevation =
    elevationAt(
      coordinate[0],
      coordinate[1],
    );

  return (
    elevation != null &&
    Number.isFinite(
      elevation,
    )
  )
    ? elevation
    : null;
}

function cellPolygon(
  center:
    [number, number],
  sizeM: number,
): GeoJSON.Polygon {
  const half =
    sizeM / 2;

  const southwest =
    offsetCoordinate(
      center[0],
      center[1],
      -half,
      -half,
    );

  const southeast =
    offsetCoordinate(
      center[0],
      center[1],
      half,
      -half,
    );

  const northeast =
    offsetCoordinate(
      center[0],
      center[1],
      half,
      half,
    );

  const northwest =
    offsetCoordinate(
      center[0],
      center[1],
      -half,
      half,
    );

  return {
    type:
      "Polygon",

    coordinates: [[
      southwest,
      southeast,
      northeast,
      northwest,
      southwest,
    ]],
  };
}

export function lineOfSightBlocked(
  options: {
    from:
      [number, number];

    to:
      [number, number];

    fromAltitudeM:
      number;

    toAltitudeM:
      number;

    elevationAt:
      ElevationSampler;

    samples?:
      number;

    clearanceM?:
      number;
  },
) {
  const samples =
    Math.max(
      3,
      Math.floor(
        options.samples ??
        8,
      ),
    );

  const clearanceM =
    Math.max(
      0,
      options.clearanceM ??
      1,
    );

  let validSamples =
    0;

  for (
    let index = 1;
    index < samples;
    index += 1
  ) {
    const ratio =
      index /
      samples;

    const longitude =
      options.from[0] +
      (
        options.to[0] -
        options.from[0]
      ) *
      ratio;

    const latitude =
      options.from[1] +
      (
        options.to[1] -
        options.from[1]
      ) *
      ratio;

    const terrainElevation =
      options.elevationAt(
        longitude,
        latitude,
      );

    if (
      terrainElevation == null ||
      !Number.isFinite(
        terrainElevation,
      )
    ) {
      continue;
    }

    validSamples += 1;

    const lineAltitude =
      options.fromAltitudeM +
      (
        options.toAltitudeM -
        options.fromAltitudeM
      ) *
      ratio;

    if (
      terrainElevation +
      clearanceM >
      lineAltitude
    ) {
      return {
        blocked: true,

        validSamples,
      };
    }
  }

  return {
    blocked:
      false,

    validSamples,
  };
}

function observerAltitude(
  observer:
    TerrainObserver,
  groundElevationM:
    number,
) {
  const supplied =
    observer.altitudeM;

  if (
    supplied != null &&
    Number.isFinite(
      supplied,
    ) &&
    supplied >
      groundElevationM +
      0.5
  ) {
    return supplied;
  }

  return (
    groundElevationM +
    Math.max(
      1.5,
      observer
        .heightAboveGroundM ??
      8,
    )
  );
}

export function buildTerrainAnalysis(
  options:
    TerrainAnalysisOptions,
): TerrainAnalysisResult {
  const radiusM =
    Math.max(
      120,
      options.radiusM,
    );

  const cellSizeM =
    Math.max(
      30,
      options.cellSizeM,
    );

  const halfCells =
    Math.max(
      1,
      Math.floor(
        radiusM /
        cellSizeM,
      ),
    );

  const slopeWarningDeg =
    options.slopeWarningDeg ??
    25;

  const targetHeightAboveGroundM =
    options
      .targetHeightAboveGroundM ??
    1.7;

  const slopeFeatures:
    GeoJSON.Feature[] = [];

  const viewshedFeatures:
    GeoJSON.Feature[] = [];

  const shadowFeatures:
    GeoJSON.Feature[] = [];

  let sampledCells =
    0;

  let missingCells =
    0;

  let steepCells =
    0;

  let maxSlopeDeg:
    number | null =
    null;

  const observerGround =
    safeElevation(
      options.elevationAt,
      [
        options.observer
          .longitude,

        options.observer
          .latitude,
      ],
    );

  const observerAbsoluteAltitude =
    observerGround == null
      ? null
      : observerAltitude(
          options.observer,
          observerGround,
        );

  for (
    let y = -halfCells;
    y <= halfCells;
    y += 1
  ) {
    for (
      let x = -halfCells;
      x <= halfCells;
      x += 1
    ) {
      const eastM =
        x *
        cellSizeM;

      const northM =
        y *
        cellSizeM;

      if (
        Math.hypot(
          eastM,
          northM,
        ) >
        radiusM
      ) {
        continue;
      }

      const center =
        offsetCoordinate(
          options.center[0],
          options.center[1],
          eastM,
          northM,
        );

      const centerElevation =
        safeElevation(
          options.elevationAt,
          center,
        );

      const west =
        safeElevation(
          options.elevationAt,
          offsetCoordinate(
            center[0],
            center[1],
            -cellSizeM,
            0,
          ),
        );

      const east =
        safeElevation(
          options.elevationAt,
          offsetCoordinate(
            center[0],
            center[1],
            cellSizeM,
            0,
          ),
        );

      const south =
        safeElevation(
          options.elevationAt,
          offsetCoordinate(
            center[0],
            center[1],
            0,
            -cellSizeM,
          ),
        );

      const north =
        safeElevation(
          options.elevationAt,
          offsetCoordinate(
            center[0],
            center[1],
            0,
            cellSizeM,
          ),
        );

      if (
        centerElevation == null ||
        west == null ||
        east == null ||
        south == null ||
        north == null
      ) {
        missingCells += 1;
        continue;
      }

      sampledCells += 1;

      const slopeDeg =
        calculateSlopeDegrees(
          west,
          east,
          south,
          north,
          cellSizeM,
        );

      maxSlopeDeg =
        maxSlopeDeg == null
          ? slopeDeg
          : Math.max(
              maxSlopeDeg,
              slopeDeg,
            );

      if (
        slopeDeg >=
        slopeWarningDeg
      ) {
        steepCells += 1;
      }

      const polygon =
        cellPolygon(
          center,
          cellSizeM,
        );

      slopeFeatures.push({
        type:
          "Feature",

        geometry:
          polygon,

        properties: {
          source:
            "RASTER_DEM",

          calculation:
            "CENTRAL_DIFFERENCE",

          elevationM:
            Number(
              centerElevation
                .toFixed(2),
            ),

          slopeDeg:
            Number(
              slopeDeg
                .toFixed(2),
            ),

          steep:
            slopeDeg >=
            slopeWarningDeg,
        },
      });

      if (
        observerAbsoluteAltitude ==
        null
      ) {
        continue;
      }

      const targetAltitude =
        centerElevation +
        targetHeightAboveGroundM;

      const los =
        lineOfSightBlocked({
          from: [
            options.observer
              .longitude,

            options.observer
              .latitude,
          ],

          to:
            center,

          fromAltitudeM:
            observerAbsoluteAltitude,

          toAltitudeM:
            targetAltitude,

          elevationAt:
            options.elevationAt,

          samples:
            options.losSamples,

          clearanceM:
            options.clearanceM,
        });

      /*
       * 중간 DEM 표본이 하나도 없으면
       * 보이는 것으로 추정하지 않는다.
       */
      if (
        los.validSamples === 0 &&
        (
          Math.abs(x) > 1 ||
          Math.abs(y) > 1
        )
      ) {
        continue;
      }

      const feature:
        GeoJSON.Feature = {
        type:
          "Feature",

        geometry:
          polygon,

        properties: {
          source:
            "RASTER_DEM",

          observerId:
            options.observer.id,

          observerAltitudeM:
            Number(
              observerAbsoluteAltitude
                .toFixed(2),
            ),

          targetElevationM:
            Number(
              centerElevation
                .toFixed(2),
            ),

          visible:
            !los.blocked,

          blocked:
            los.blocked,

          losSamples:
            los.validSamples,
        },
      };

      if (
        los.blocked
      ) {
        shadowFeatures.push(
          feature,
        );
      } else {
        viewshedFeatures.push(
          feature,
        );
      }
    }
  }

  return {
    source:
      "RASTER_DEM",

    calculatedAt:
      new Date()
        .toISOString(),

    observerId:
      options.observer.id,

    sampledCells,

    missingCells,

    slopeCells:
      slopeFeatures.length,

    steepCells,

    maxSlopeDeg:
      maxSlopeDeg == null
        ? null
        : Number(
            maxSlopeDeg
              .toFixed(2),
          ),

    viewshedCells:
      viewshedFeatures.length,

    shadowCells:
      shadowFeatures.length,

    slopeGeoJson: {
      type:
        "FeatureCollection",

      features:
        slopeFeatures,
    },

    viewshedGeoJson: {
      type:
        "FeatureCollection",

      features:
        viewshedFeatures,
    },

    shadowGeoJson: {
      type:
        "FeatureCollection",

      features:
        shadowFeatures,
    },
  };
}
