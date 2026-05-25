/**
 * API Endpoints Documentation
 * Category Filtering & Search
 */

/**
 * GET /api/search/categories
 * Get all available menu item categories
 * 
 * Response:
 * {
 *   "success": true,
 *   "categories": [
 *     {
 *       "id": "biryani",
 *       "name": "Biryani",
 *       "displayName": "Biryani"
 *     },
 *     ...
 *   ]
 * }
 */

/**
 * GET /api/search/by-category/:category
 * Filter restaurants by menu item category
 * 
 * URL Parameters:
 *   category: string (required) - Category name (e.g., "biryani", "fried rice")
 *   
 * Query Parameters: (optional)
 *   None currently supported, but could add:
 *   - rating: minimum rating
 *   - maxPrice: maximum item price
 *   - veg: true/false for vegetarian filter
 * 
 * Response:
 * {
 *   "success": true,
 *   "category": "Biryani",
 *   "count": 5,
 *   "restaurants": [
 *     {
 *       "id": "uuid",
 *       "name": "Ibbus Kings Hotel",
 *       "image": "url",
 *       "logo": "url",
 *       "rating": 4.5,
 *       "average_rating": 4.5,
 *       "rating_count": 120,
 *       "delivery_time": "25-35 mins",
 *       "price_for_one": 300,
 *       "cuisines": ["Indian", "Biryani"],
 *       "offer": "20% OFF",
 *       "featured": false,
 *       "is_open": true,
 *       "status": "OPEN",
 *       ...
 *     }
 *   ],
 *   "message": "Found 5 restaurants serving Biryani"
 * }
 * 
 * Errors:
 * {
 *   "success": false,
 *   "error": "Category is required"
 * }
 * 
 * SQL Query (internal):
 * SELECT DISTINCT r.*,
 *        CASE
 *          WHEN COALESCE(r.rating_count, 0) > 0
 *          THEN ROUND((COALESCE(r.rating_sum, 0) / NULLIF(r.rating_count, 0))::numeric, 1)
 *          ELSE COALESCE(r.rating, 0)
 *        END AS average_rating,
 *        COALESCE(r.rating_count, 0) AS rating_count
 * FROM restaurants r
 * INNER JOIN menu_items mi ON r.id = mi.restaurant_id
 * WHERE LOWER(TRIM(REGEXP_REPLACE(mi.category, '[^a-z0-9\s]', '', 'g'))) ILIKE $1
 *   AND mi.in_stock = TRUE
 *   AND r.is_open = TRUE
 * ORDER BY
 *   CASE WHEN COALESCE(r.status, ...) = 'OPEN' THEN 0 ELSE 1 END,
 *   average_rating DESC,
 *   r.name ASC
 */

/**
 * GET /api/search
 * Search for restaurants and menu items
 * 
 * Query Parameters:
 *   q: string - Search query (e.g., "biryani", "pizza")
 *   veg: "true" | "false" - Filter by vegetarian (optional)
 *   rating: number - Minimum rating (optional)
 *   maxPrice: number - Maximum item price (optional)
 * 
 * Response:
 * {
 *   "success": true,
 *   "query": "biryani",
 *   "restaurants": [
 *     {
 *       "id": "uuid",
 *       "name": "Ibbus Kings Hotel",
 *       ...
 *     }
 *   ],
 *   "menuItems": [
 *     {
 *       "id": "uuid",
 *       "restaurant_id": "uuid",
 *       "restaurant_name": "Ibbus Kings Hotel",
 *       "restaurant_delivery_time": "25-35 mins",
 *       "name": "Chicken Biryani",
 *       "price": 250,
 *       "image": "url",
 *       "category": "Biryani",
 *       "is_veg": false,
 *       "in_stock": true,
 *       ...
 *     }
 *   ],
 *   "summary": {
 *     "restaurantCount": 5,
 *     "menuItemCount": 12
 *   }
 * }
 * 
 * Features:
 * - Case-insensitive matching (biryani = BIRYANI)
 * - Partial word matching (searches name, description, category)
 * - Combines results from restaurant names, descriptions, and menu items
 * - Removes duplicate restaurants in results
 * - Menu items sorted by bestseller status
 * - Restaurants sorted by rating
 * 
 * SQL Query (internal - Restaurants):
 * SELECT DISTINCT r.*,
 *        ...average_rating calculation...
 * FROM restaurants r
 * WHERE (
 *   r.name ILIKE $1
 *   OR r.description ILIKE $1
 *   OR EXISTS (SELECT 1 FROM unnest(r.cuisines) c WHERE c ILIKE $1)
 * )
 * AND r.rating >= $2
 * AND r.is_open = TRUE
 * ORDER BY average_rating DESC, r.name ASC
 * LIMIT 15
 * 
 * SQL Query (internal - Menu Items):
 * SELECT DISTINCT mi.*, r.name, r.delivery_time, r.id
 * FROM menu_items mi
 * JOIN restaurants r ON mi.restaurant_id = r.id
 * WHERE (
 *   mi.name ILIKE $1
 *   OR mi.description ILIKE $1
 *   OR mi.category ILIKE $1
 * )
 * AND mi.in_stock = TRUE
 * AND r.is_open = TRUE
 * [AND mi.is_veg = TRUE]  [if veg filter]
 * [AND mi.price <= $N]    [if maxPrice filter]
 * ORDER BY mi.is_bestseller DESC, mi.name ASC
 * LIMIT 30
 */

/**
 * Implementation Notes:
 * 
 * 1. Category Matching Strategy:
 *    - LOWER() - Convert to lowercase
 *    - TRIM() - Remove leading/trailing whitespace
 *    - REGEXP_REPLACE(..., '[^a-z0-9\s]', '', 'g') - Remove special characters
 *    - ILIKE '%pattern%' - Case-insensitive partial matching
 *    
 *    This normalizes "Fried-Rice", "FRIED RICE", "friedrice", "Fried Rice" all to the same
 * 
 * 2. Performance Optimizations:
 *    - INNER JOIN (not LEFT) filters restaurants early
 *    - DISTINCT prevents duplicate rows
 *    - Indexes on menu_items.category, menu_items.restaurant_id
 *    - LIMIT clauses prevent large result sets
 *    - Filters by is_open = TRUE to exclude closed restaurants
 * 
 * 3. Database Requirements:
 *    - PostgreSQL (for REGEXP_REPLACE, array operations)
 *    - Tables: restaurants, menu_items
 *    - Indexes: idx_menu_items_restaurant_id, idx_menu_items_category
 *    - Columns: menu_items.category, menu_items.in_stock
 * 
 * 4. Frontend Integration:
 *    - RestaurantsClientPage: calls /search/by-category for category filtering
 *    - LiveSearchBar: calls /search for live search with debounce
 *    - Both show proper error states and loading indicators
 * 
 * 5. Future Enhancements:
 *    - Add /categories/:category/trending for trending items
 *    - Add /categories/:category/offers for category-specific offers
 *    - Add analytics tracking to most_searched_categories
 *    - Add fuzzy matching for typo tolerance
 *    - Add synonyms (e.g., "fry" = "fried rice")
 */
