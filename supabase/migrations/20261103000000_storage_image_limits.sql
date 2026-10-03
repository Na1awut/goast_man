-- ============================================================
-- Uploads to the public buckets must be images, and not huge
--
-- store-banners (public) and chat-images (private) accepted any file type and
-- size. A page, an SVG with a script or a 2 GB file does not belong there:
-- anyone who opens the link would be running someone else's file under our
-- storage address. Only pictures, 5 MB for chat photos and 8 MB for store
-- pictures. Existing files stay where they are; this applies to new uploads.
-- ============================================================
do $$ begin
	update storage.buckets set file_size_limit = 5242880,
		allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
	where id = 'chat-images';
	update storage.buckets set file_size_limit = 8388608,
		allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif']
	where id = 'store-banners';
exception when undefined_column then
	raise notice 'storage.buckets has no size/type columns here';
end $$;
