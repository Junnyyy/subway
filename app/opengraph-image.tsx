import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "Subway in Motion with a blue A train line on a dark background";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const geist = await readFile(
  join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"),
);

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#060709",
          color: "#f1f3f4",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Geist",
          height: "100%",
          justifyContent: "center",
          padding: "66px 76px 82px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 116,
            fontWeight: 400,
            letterSpacing: "-0.06em",
            lineHeight: 0.88,
          }}
        >
          <span>Subway</span>
          <span>in motion</span>
        </div>

        <div
          style={{
            alignItems: "center",
            bottom: 68,
            display: "flex",
            left: 0,
            position: "absolute",
          }}
        >
          <div style={{ background: "#0039a6", height: 14, width: 917 }} />
          <div
            style={{
              alignItems: "center",
              background: "#0039a6",
              borderRadius: "50%",
              color: "#ffffff",
              display: "flex",
              fontSize: 76,
              fontWeight: 400,
              height: 126,
              justifyContent: "center",
              lineHeight: 1,
              width: 126,
            }}
          >
            <span style={{ display: "flex", transform: "translateY(-3px)" }}>
              A
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Geist",
          data: geist,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
