export default function CustomerSummaryCard({
  name,
  email,
  rating,
  ratingCount,
}: {
  name: string | null;
  email: string | null;
  rating: number | null;
  ratingCount: number;
}) {
  return (
    <section style={card}>
      <p style={eyebrow}>Your customer</p>
      <div style={head}>
        <div style={{ minWidth: 0 }}>
          <h2 style={title}>{name?.trim() || "Customer"}</h2>
          {email && <p style={emailStyle}>{email}</p>}
        </div>
        <div style={ratingBox}>
          {rating !== null && ratingCount > 0 ? (
            <>
              <strong style={ratingValue}>{rating.toFixed(1)} ★</strong>
              <span style={ratingMeta}>
                {ratingCount} provider{" "}
                {ratingCount === 1 ? "rating" : "ratings"}
              </span>
            </>
          ) : (
            <>
              <strong style={{ ...ratingValue, fontSize: 14 }}>
                New customer
              </strong>
              <span style={ratingMeta}>No provider ratings yet</span>
            </>
          )}
        </div>
      </div>
      <p style={help}>
        This score comes from providers after completed visits. Use Messages for
        arrival details or anything you need before the job.
      </p>
    </section>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "2px solid #EDEFF1",
  borderRadius: 20,
  padding: "20px 22px",
};
const eyebrow: React.CSSProperties = {
  color: "#6D28D9",
  fontSize: 11.5,
  fontWeight: 900,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  margin: "0 0 7px",
};
const head: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};
const title: React.CSSProperties = {
  color: "#16202A",
  fontSize: 20,
  fontWeight: 900,
  margin: 0,
};
const emailStyle: React.CSSProperties = {
  color: "#7A828C",
  fontSize: 13.5,
  fontWeight: 600,
  overflowWrap: "anywhere",
  margin: "3px 0 0",
};
const ratingBox: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  background: "#FFF8E8",
  border: "1px solid #F4E3B6",
  borderRadius: 12,
  padding: "9px 12px",
};
const ratingValue: React.CSSProperties = {
  color: "#8A5A00",
  fontSize: 18,
  fontWeight: 900,
};
const ratingMeta: React.CSSProperties = {
  color: "#8A6B2B",
  fontSize: 11.5,
  fontWeight: 700,
};
const help: React.CSSProperties = {
  color: "#7A828C",
  fontSize: 13.5,
  fontWeight: 600,
  lineHeight: 1.5,
  margin: "13px 0 0",
};
