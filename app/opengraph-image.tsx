import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "Subway in Motion with a blue A train line on a light background";
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
          background: "#f7f7f7",
          color: "#0f0e13",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Geist",
          height: "100%",
          padding: "78px 76px 82px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            color: "#65656a",
            display: "flex",
            fontSize: 19,
            fontWeight: 400,
            letterSpacing: "0.14em",
            lineHeight: 1,
          }}
        >
          NEW YORK CITY
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 98,
            fontWeight: 400,
            letterSpacing: "-0.035em",
            lineHeight: 0.96,
            marginTop: 68,
          }}
        >
          <span>Subway</span>
          <span>in motion</span>
        </div>

        <div
          style={{
            alignItems: "center",
            bottom: 72,
            display: "flex",
            left: 0,
            position: "absolute",
          }}
        >
          <div style={{ background: "#0039a6", height: 10, width: 920 }} />
          <div
            style={{
              alignItems: "center",
              background: "#0039a6",
              borderRadius: "50%",
              display: "flex",
              height: 120,
              justifyContent: "center",
              width: 120,
            }}
          >
            <svg height="61" viewBox="0 0 46 54" width="52">
              <path
                d="M23 0 46 53.5H35.2l-4.8-12H15.6l-4.8 12H0L23 0Zm0 20-4.3 11.4h8.6L23 20Z"
                fill="#ffffff"
                fillRule="evenodd"
              />
            </svg>
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
