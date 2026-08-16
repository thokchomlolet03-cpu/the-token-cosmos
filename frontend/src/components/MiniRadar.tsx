import React, { useState } from 'react';
import { SEMANTIC_BIOMES, getSectorCode, getDominantBiome, GRATICULE_COLS, GRATICULE_ROWS } from '../terrain/semanticBiomes';

interface MiniRadarProps {
  cameraAngle: number; // in radians
  cameraDistance: number;
  cameraPos: { x: number; z: number };
  targetPos: { x: number; z: number };
  activeToken?: {
    tokenStr: string;
    probability: number;
    umapX: number;
    umapY: number;
  } | null;
  onSelectSector?: (sector: string) => void;
}

export const MiniRadar: React.FC<MiniRadarProps> = ({
  cameraAngle,
  cameraPos,
  targetPos,
  activeToken,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const radarSize = 140; // px
  const center = radarSize / 2;
  const scale = (radarSize / 2) * 0.85; // maps normalized [-1, 1] to radar pixels

  // Active token position in radar pixels
  const activePoint = activeToken
    ? {
        x: center + activeToken.umapX * scale,
        y: center - activeToken.umapY * scale, // invert Y for SVG screen coordinates
      }
    : null;

  // Active Sector & Biome
  const activeSector = activeToken ? getSectorCode(activeToken.umapX, activeToken.umapY) : 'C-03';
  const dominantBiome = activeToken ? getDominantBiome(activeToken.umapX, activeToken.umapY) : SEMANTIC_BIOMES[4];

  // Camera frustum indicator
  const camDirX = targetPos.x - cameraPos.x;
  const camDirZ = targetPos.z - cameraPos.z;
  const camAngleRad = Math.atan2(camDirZ, camDirX);

  const fovHalf = Math.PI / 6; // 30 deg cone
  const coneLength = 38;

  const p1x = center + Math.cos(camAngleRad - fovHalf) * coneLength;
  const p1y = center + Math.sin(camAngleRad - fovHalf) * coneLength;
  const p2x = center + Math.cos(camAngleRad + fovHalf) * coneLength;
  const p2y = center + Math.sin(camAngleRad + fovHalf) * coneLength;

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end pointer-events-auto">
      {/* Radar Panel */}
      <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-2xl p-2.5 transition-all duration-300">
        <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono tracking-wider font-semibold text-slate-300 uppercase">
              SEMANTIC RADAR
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[9px] font-mono text-slate-400 hover:text-cyan-300 transition-colors"
            title="Toggle Mini-Radar Size"
          >
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>

        {isExpanded && (
          <>
            {/* SVG Radar Map */}
            <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
              <svg width={radarSize} height={radarSize} className="block">
                {/* 1. Biome Territory Polygons / Radial Glows */}
                {SEMANTIC_BIOMES.map((b) => {
                  const bx = center + b.center[0] * scale;
                  const by = center - b.center[1] * scale;
                  const br = b.radius * scale * 0.9;
                  return (
                    <circle
                      key={b.id}
                      cx={bx}
                      cy={by}
                      r={br}
                      fill={b.colorHex}
                      fillOpacity={0.12}
                      stroke={b.colorHex}
                      strokeWidth={0.75}
                      strokeDasharray="2 2"
                      strokeOpacity={0.4}
                    />
                  );
                })}

                {/* 2. Graticule Grid Lines (6x6) */}
                {GRATICULE_COLS.map((_, i) => {
                  const x = (radarSize / GRATICULE_COLS.length) * (i + 1);
                  return (
                    <line
                      key={`col-${i}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={radarSize}
                      stroke="#334155"
                      strokeWidth={0.5}
                      strokeOpacity={0.35}
                    />
                  );
                })}
                {GRATICULE_ROWS.map((_, i) => {
                  const y = (radarSize / GRATICULE_ROWS.length) * (i + 1);
                  return (
                    <line
                      key={`row-${i}`}
                      x1={0}
                      y1={y}
                      x2={radarSize}
                      y2={y}
                      stroke="#334155"
                      strokeWidth={0.5}
                      strokeOpacity={0.35}
                    />
                  );
                })}

                {/* 3. Radar Center Reticle & Range Rings */}
                <circle cx={center} cy={center} r={scale * 0.5} fill="none" stroke="#475569" strokeWidth={0.5} strokeDasharray="1 3" />
                <circle cx={center} cy={center} r={scale} fill="none" stroke="#475569" strokeWidth={0.75} strokeOpacity={0.5} />
                <line x1={center - 4} y1={center} x2={center + 4} y2={center} stroke="#64748B" strokeWidth={1} />
                <line x1={center} y1={center - 4} x2={center} y2={center + 4} stroke="#64748B" strokeWidth={1} />

                {/* 4. Camera View Frustum Cone */}
                <polygon
                  points={`${center},${center} ${p1x},${p1y} ${p2x},${p2y}`}
                  fill="#38BDF8"
                  fillOpacity={0.18}
                  stroke="#38BDF8"
                  strokeWidth={0.75}
                  strokeOpacity={0.6}
                />

                {/* 5. Active Target Pin */}
                {activePoint && (
                  <g>
                    {/* Pulsing Beacon */}
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r={7}
                      fill={dominantBiome.colorHex}
                      fillOpacity={0.3}
                      className="animate-ping"
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r={3.5}
                      fill="#FFFFFF"
                      stroke={dominantBiome.colorHex}
                      strokeWidth={1.5}
                    />
                  </g>
                )}
              </svg>

              {/* Cardinal Orientation Notches */}
              <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-mono text-slate-500 font-bold">N: GEO</span>
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-mono text-slate-500 font-bold">S: SYN</span>
              <span className="absolute top-1/2 left-0.5 -translate-y-1/2 text-[8px] font-mono text-slate-500 font-bold">W: VRB</span>
              <span className="absolute top-1/2 right-0.5 -translate-y-1/2 text-[8px] font-mono text-slate-500 font-bold">E: NUM</span>
            </div>

            {/* Readout Bar */}
            <div className="mt-1.5 flex flex-col gap-0.5 text-[9px] font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Sector:</span>
                <span className="text-cyan-300 font-bold">{activeSector}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 truncate max-w-[140px]">
                <span className="truncate" style={{ color: dominantBiome.colorHex }}>
                  {dominantBiome.shortLabel}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
