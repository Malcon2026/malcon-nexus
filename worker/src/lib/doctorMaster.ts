export type DoctorMasterEntry = { code: string; name: string; id: string };

function compareDoctorCodes(a?: string, b?: string): number {
  const na = a ? parseInt(a.replace(/\D/g, ''), 10) : 99999;
  const nb = b ? parseInt(b.replace(/\D/g, ''), 10) : 99999;
  return na - nb;
}

export function mergeDoctorMasterList(existingJson: string | undefined, entry: DoctorMasterEntry): string {
  let list: DoctorMasterEntry[] = [];
  if (existingJson) {
    try {
      list = JSON.parse(existingJson) as DoctorMasterEntry[];
    } catch {
      list = [];
    }
  }
  if (!list.some((r) => r.id === entry.id)) {
    list.push(entry);
    list.sort((x, y) => compareDoctorCodes(x.code, y.code));
  }
  return JSON.stringify(list);
}
