"use client";
import { Rectangle, Sector, type BarShapeProps, type PieSectorShapeProps } from "recharts";

// Per-datum colors via the `shape` prop (Cell is deprecated in Recharts 3).
// Each data item carries its own `color`.
const colorOf = (payload: unknown, fallback?: string) =>
  (payload as { color?: string } | undefined)?.color ?? fallback;

export const ColoredBar = (props: BarShapeProps) => <Rectangle {...props} fill={colorOf(props.payload, props.fill)} />;
export const ColoredSector = (props: PieSectorShapeProps) => <Sector {...props} fill={colorOf(props.payload, props.fill)} />;
