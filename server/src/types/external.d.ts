declare module 'supertest';

declare module 'geotiff' {
	export type TypedArray =
		| Uint8Array
		| Uint16Array
		| Uint32Array
		| Int8Array
		| Int16Array
		| Int32Array
		| Float32Array
		| Float64Array;

	export interface GeoTIFFImage {
		getBoundingBox(): [number, number, number, number];
		getResolution(): [number, number];
		getWidth(): number;
		getHeight(): number;
		readRasters(options: {
			window: [number, number, number, number];
			width: number;
			height: number;
			samples?: number[];
			interleave?: boolean;
		}): Promise<TypedArray | TypedArray[]>;
		getFileDirectory(): Record<string, unknown>;
		getGDALNoData?(): number | string | null | undefined;
	}

	export interface GeoTIFF {
		getImage(index?: number): Promise<GeoTIFFImage>;
	}

	export function fromFile(path: string): Promise<GeoTIFF>;
}
