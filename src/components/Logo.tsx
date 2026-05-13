import logo from "@/assets/mca-logo.jpg";

export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={logo}
      alt="Logo MCA"
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
