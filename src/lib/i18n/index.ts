import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'en' | 'te'

export const dictionaries = {
  en: {
    // General
    thinava: 'Thinava',
    tagline: 'Hyperlocal Food Delivery in Tadepalligudem',
    home: 'Home',
    orders: 'Orders',
    cart: 'Cart',
    checkout: 'Checkout',
    login: 'Login',
    logout: 'Logout',
    profile: 'Profile',
    loading: 'Loading...',
    error: 'Error',
    search: 'Search',
    filter: 'Filter',
    apply: 'Apply',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    back: 'Back',
    confirm: 'Confirm',

    // Search & Home
    heroTitle: 'Delicious Food Delivered to Your Doorstep',
    heroSubtitle: 'Fresh, hot, and hygienic meals from Tadepalligudems top restaurants, delivered in minutes.',
    searchPlaceholder: 'Search restaurants, cuisines, or dishes...',
    exploreRestaurants: 'Explore restaurants in Tadepalligudem',
    searchFilters: 'Search Filters',
    all: 'All',
    vegOnly: 'Veg Only',
    nonVeg: 'Non-Veg',
    maxPrice: 'Max Price',
    minRating: 'Min Rating',
    sortBy: 'Sort By',
    restaurants: 'Restaurants',
    dishes: 'Dishes',
    noResults: 'No results found matching your search',
    inStock: 'In Stock',
    outOfStock: 'Out of Stock',
    deliveryTime: 'delivery time',
    mins: 'mins',
    rating: 'Rating',

    // Restaurant details
    mustTry: 'Must Try',
    cuisines: 'Cuisines',
    addToCart: 'Add to Cart',
    added: 'Added',
    viewCart: 'View Cart',

    // Checkout
    checkoutTitle: 'Complete Your Order',
    deliveryAddress: 'Delivery Address',
    paymentMethod: 'Payment Method',
    cashOnDelivery: 'Cash on Delivery (COD)',
    onlinePayment: 'Online Payment (UPI/Card)',
    promoCode: 'Promo Code',
    applyPromo: 'Apply Promo',
    promoApplied: 'Promo code applied successfully!',
    enterPromo: 'Enter promo code',
    orderSummary: 'Order Summary',
    subtotal: 'Subtotal',
    deliveryFee: 'Delivery Fee',
    tax: 'Taxes & Charges',
    discount: 'Discount',
    total: 'Grand Total',
    placeOrder: 'Place Order',
    placingOrder: 'Placing your order...',
    minOrderError: 'Minimum order amount not met',

    // Order status & Tracking
    orderStatus: 'Order Status',
    orderPlaced: 'Order Placed',
    orderAccepted: 'Accepted by Restaurant',
    orderPreparing: 'Preparing Your Meal',
    outForDelivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    trackOrder: 'Track Order',
    liveTracking: 'Live GPS Tracking',
    driverDetails: 'Rider Details',
    estimatedTime: 'Estimated Delivery Time',
    invoice: 'Invoice',
    printInvoice: 'Print Invoice',
    downloadInvoice: 'Download Receipt',

    // Ratings & Reviews
    rateOrder: 'Rate Your Order',
    restaurantRating: 'Rate the Restaurant',
    riderRating: 'Rate the Delivery Rider',
    ratingComment: 'Write a review (optional)',
    submitReview: 'Submit Review',
    reviewSuccess: 'Thank you for your feedback!',
    ratingRequired: 'Please select a rating',
  },
  te: {
    // General
    thinava: 'థినవా',
    tagline: 'తాడేపల్లిగూడెంలో హైపర్‌లోకల్ ఫుడ్ డెలివరీ',
    home: 'హోమ్',
    orders: 'ఆర్డర్లు',
    cart: 'కార్ట్',
    checkout: 'చెకౌట్',
    login: 'లాగిన్',
    logout: 'లాగౌట్',
    profile: 'ప్రొఫైల్',
    loading: 'లోడ్ అవుతోంది...',
    error: 'లోపం',
    search: 'వెతకండి',
    filter: 'ఫిల్టర్',
    apply: 'వర్తింపజేయి',
    cancel: 'రద్దు చేయి',
    save: 'సేవ్ చేయి',
    close: 'మూసివేయి',
    back: 'వెనుకకు',
    confirm: 'ధృవీకరించు',

    // Search & Home
    heroTitle: 'రుచికరమైన ఆహారం మీ ఇంటి వద్దకే',
    heroSubtitle: 'తాడేపల్లిగూడెంలోని ఉత్తమ రెస్టారెంట్ల నుండి తాజా, వేడి ఆహారం నిమిషాల్లో డెలివరీ.',
    searchPlaceholder: 'రెస్టారెంట్లు, వంటకాలు లేదా డిష్‌లు వెతకండి...',
    exploreRestaurants: 'తాడేపల్లిగూడెంలోని రెస్టారెంట్లను అన్వేషించండి',
    searchFilters: 'సెర్చ్ ఫిల్టర్లు',
    all: 'అన్నీ',
    vegOnly: 'శాకాహారం మాత్రమే',
    nonVeg: 'మాంసాహారం',
    maxPrice: 'గరిష్ట ధర',
    minRating: 'కనిష్ట రేటింగ్',
    sortBy: 'வரிசைப்படுத்து',
    restaurants: 'రెస్టారెంట్లు',
    dishes: 'వంటకాలు',
    noResults: 'మీ శోధనకు తగిన ఫలితాలు లేవు',
    inStock: 'ఉంది',
    outOfStock: 'అయిపోయింది',
    deliveryTime: 'డెలివరీ సమయం',
    mins: 'నిమిషాలు',
    rating: 'రేటింగ్',

    // Restaurant details
    mustTry: 'తప్పక రుచి చూడండి',
    cuisines: 'రుచులు',
    addToCart: 'కార్ట్‌కు జోడించు',
    added: 'జోడించబడింది',
    viewCart: 'కార్ట్ చూడండి',

    // Checkout
    checkoutTitle: 'మీ ఆర్డర్ పూర్తి చేయండి',
    deliveryAddress: 'డెలివరీ చిరునామా',
    paymentMethod: 'చెల్లింపు పద్ధతి',
    cashOnDelivery: 'క్యాష్ ఆన్ డెలివరీ (COD)',
    onlinePayment: 'ఆన్‌లైన్ చెల్లింపు (UPI/కార్డ్)',
    promoCode: 'ప్రోమో కోడ్',
    applyPromo: 'కూపన్ వర్తింపజేయి',
    promoApplied: 'కూపన్ కోడ్ విజయవంతంగా వర్తింపజేయబడింది!',
    enterPromo: 'కూపన్ కోడ్ ఎంటర్ చేయండి',
    orderSummary: 'ఆర్డర్ సారాంశం',
    subtotal: 'ఉపమొత్తం',
    deliveryFee: 'డెలివరీ ఛార్జీ',
    tax: 'పన్నులు & ఇతర ఛార్జీలు',
    discount: 'డిస్కౌంట్',
    total: 'మొత్తం ధర',
    placeOrder: 'ఆర్డర్ చేయండి',
    placingOrder: 'ఆర్డర్ ప్లేస్ అవుతోంది...',
    minOrderError: 'కనిష్ట ఆర్డర్ మొత్తం సరిపోలేదు',

    // Order status & Tracking
    orderStatus: 'ఆర్డర్ స్థితి',
    orderPlaced: 'ఆర్డర్ చేయబడింది',
    orderAccepted: 'రెస్టారెంట్ ఆమోదించింది',
    orderPreparing: 'ఆహారం తయారవుతోంది',
    outForDelivery: 'డెలివరీకి బయలుదేరింది',
    delivered: 'డెలివరీ చేయబడింది',
    cancelled: 'రద్దు చేయబడింది',
    trackOrder: 'ఆర్డర్ ట్రాక్ చేయి',
    liveTracking: 'లైవ్ జీపీఎస్ ట్రాకింగ్',
    driverDetails: 'రైడర్ వివరాలు',
    estimatedTime: 'అంచనా డెలివరీ సమయం',
    invoice: 'ఇన్వాయిస్',
    printInvoice: 'ఇన్వాయిస్ ప్రింట్ చేయి',
    downloadInvoice: 'రశీదు డౌన్‌లోడ్ చేయి',

    // Ratings & Reviews
    rateOrder: 'ఆర్డర్ రేటింగ్ ఇవ్వండి',
    restaurantRating: 'రెస్టారెంట్‌ను రేట్ చేయండి',
    riderRating: 'డెలివరీ రైడర్‌ను రేట్ చేయండి',
    ratingComment: 'మీ అభిప్రాయాన్ని రాయండి (ఐచ్ఛికం)',
    submitReview: 'సమీక్షను సమర్పించండి',
    reviewSuccess: 'మీ విలువైన అభిప్రాయానికి ధన్యవాదాలు!',
    ratingRequired: 'దయచేసి రేటింగ్ ఎంచుకోండి',
  }
}

interface LanguageState {
  language: Language
  setLanguage: (lang: Language) => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'thinava-language-store',
    }
  )
)

export const useTranslation = () => {
  const { language, setLanguage } = useLanguageStore()
  const t = (key: keyof typeof dictionaries.en): string => {
    return dictionaries[language][key] || dictionaries.en[key] || String(key)
  }

  return { t, language, setLanguage }
}
