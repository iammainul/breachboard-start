import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "64px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0F0D",
          color: "#FFFFFF",
          fontSize: 34,
          fontWeight: 700,
          borderRadius: 14,
          border: "4px solid #FFFFFF",
          position: "relative",
        }}
      >
        B
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "#5B8CFF",
          }}
        />
      </div>
    ),
    size,
  );
}
