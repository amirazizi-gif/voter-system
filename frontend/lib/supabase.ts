import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Voter {
  id: number;
  bil: number;
  no_kp: string;
  no_kp_id_lain?: string;
  jantina: "L" | "P";
  tahun_lahir: number;
  nama_pemilih: string;
  kod_daerah_mengundi: string;
  daerah_mengundi: string;
  kod_lokaliti: string;
  lokaliti: string;
  tag?: "Yes" | "Unsure" | "No" | null;
  created_at?: string;
  updated_at?: string;
}

export interface VoterFilters {
  nameSearch?: string;
  gender?: "L" | "P" | "";
  ageGroup?: "18-30" | "30-40" | "40-55" | "55+" | "";
  specificAge?: number;
  daerah?: string;
  lokaliti?: string;
  tag?: "Yes" | "Unsure" | "No" | "untagged" | "";
}

export const calculateAge = (birthYear: number): number => {
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear;
};

export const fetchVoters = async (filters: VoterFilters = {}) => {
  let query = supabase.from("voters").select("*");

  // Apply filters
  if (filters.nameSearch) {
    query = query.ilike("nama_pemilih", `%${filters.nameSearch}%`);
  }

  if (filters.gender) {
    query = query.eq("jantina", filters.gender);
  }

  if (filters.daerah) {
    query = query.eq("daerah_mengundi", filters.daerah);
  }

  if (filters.lokaliti) {
    query = query.eq("lokaliti", filters.lokaliti);
  }

  if (filters.tag && filters.tag !== "untagged") {
    query = query.eq("tag", filters.tag);
  } else if (filters.tag === "untagged") {
    query = query.is("tag", null);
  }

  const { data, error } = await query.order("bil", { ascending: true });

  if (error) throw error;
  return data as Voter[];
};

export const updateVoterTag = async (
  voterId: number,
  tag: "Yes" | "Unsure" | "No" | null
) => {
  const { data, error } = await supabase
    .from("voters")
    .update({ tag })
    .eq("id", voterId)
    .select();

  if (error) throw error;
  return data;
};

type UniqueColumn = "daerah_mengundi" | "lokaliti";
type ColumnResult<T extends UniqueColumn> = { [K in T]: Voter[K] };

export const getUniqueValues = async <T extends UniqueColumn>(column: T) => {
  const { data, error } = await supabase.from("voters").select(column);

  if (error) {
    console.error(`Error fetching unique ${column}:`, error);
    throw error;
  }

  if (!data) return [];

  // Get unique values and sort
  const rows = data as ColumnResult<T>[];
  const unique = [
    ...new Set(
      rows
        .map((item) => item[column])
        .filter((value): value is Voter[T] => Boolean(value))
    ),
  ];
  return unique.sort();
};

// Get lokaliti options based on selected daerah
export const getLokalitiByDaerah = async (daerah: string) => {
  const { data, error } = await supabase
    .from("voters")
    .select("lokaliti")
    .eq("daerah_mengundi", daerah);

  if (error) {
    console.error("Error fetching lokaliti:", error);
    throw error;
  }

  if (!data) return [];

  const unique = [
    ...new Set(data.map((item) => item.lokaliti).filter(Boolean)),
  ];
  return unique.sort();
};
