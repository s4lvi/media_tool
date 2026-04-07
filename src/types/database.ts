export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_colors: string[];
  brand_fonts: string[];
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  created_at: string;
}

export interface Frame {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  aspect_ratio: string;
  storage_path: string;
  thumbnail_url: string | null;
  blend_mode: string;
  tags: string[];
  created_at: string;
}

export interface Post {
  id: string;
  organization_id: string;
  created_by: string;
  frame_template_id: string | null;
  name: string;
  width: number;
  height: number;
  photo_refs: string[];
  text_content: { heading?: string; subheading?: string; [key: string]: string | undefined };
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  organization_id: string;
  uploaded_by: string | null;
  name: string;
  type: "image" | "logo" | "icon" | "qr_code";
  storage_path: string;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  tags: string[];
  created_at: string;
}

export interface Template {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  category: string | null;
  aspect_ratio: string;
  width: number;
  height: number;
  thumbnail_url: string | null;
  canvas_json: Record<string, unknown>;
  zone_definitions: Record<string, unknown>[];
  is_published: boolean;
  is_public: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Export {
  id: string;
  project_id: string;
  created_by: string | null;
  storage_path: string;
  format: string;
  width: number;
  height: number;
  file_size_bytes: number | null;
  created_at: string;
}
