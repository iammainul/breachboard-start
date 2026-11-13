import { SECTORS } from "@/lib/sectors";

export function SectorOptions() {
  return SECTORS.map((sector) => (
    <option key={sector.id} value={sector.id}>
      {sector.label}
    </option>
  ));
}
