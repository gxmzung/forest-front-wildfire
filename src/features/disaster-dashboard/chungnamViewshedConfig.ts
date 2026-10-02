export const CHUNGNAM_VIEWSHED_CONFIG = {
  provider: "충남대학교",
  nodeId: "0486",
  routeName: "등산로_Clip",
  crsName: "Korea_2000_Central_Belt_2010",
  cellSizeM: 5,
  tvws: {
    url: "/chungnam-viewshed/tvws.tif",
    analysisRadiusM: 2500,
    antennaHeightM: 3.0,
  },
  term: {
    url: "/chungnam-viewshed/term.tif",
    analysisRadiusM: 2000,
    antennaHeightM: 1.45,
  },
} as const;
