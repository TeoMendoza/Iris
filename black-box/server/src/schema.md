**`companies`**
- id, name

**`employees`**
- id, company_id, name, email, is_admin

**`unprocessed_images`**
- id, company_id, uploaded_by, uploaded_at, image_bytes

**`processing_images`**
- id, company_id, uploaded_by, uploaded_at, image_bytes, claimed_at

**`processed_images`**
- id, company_id, uploaded_by, uploaded_at, image_bytes, processed_at
- predicted_category, predicted_color, predicted_demographic

**`item_information`**
- id, company_id, processed_image_id, confirmed_by, created_at, image_bytes
- category, color, demographic

**`item_classification`**
- id, item_information_id
- predicted_category, predicted_color, predicted_demographic

**`inventory_item`**
- id, item_information_id, status, price, created_at, updated_at, updated_by