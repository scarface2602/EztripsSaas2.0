-- Master hotel directory lookup table for autocompletion
create table if not exists master_hotel_directory (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  hotel_name text not null,
  room_type text,
  category text
);

-- Indexes for high-performance autocompletion
create index idx_master_hotel_directory_city on master_hotel_directory (city);
create index idx_master_hotel_directory_hotel_name on master_hotel_directory (hotel_name);

-- Revoke write access from anon/authenticated roles (read-only directory)
revoke insert, update, delete on master_hotel_directory from anon, authenticated;
grant select on master_hotel_directory to anon, authenticated;
