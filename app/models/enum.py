import enum

class UserRole(enum.Enum):
    buyer = 'buyer'
    seller = 'seller'
    admin = 'admin'

class OrderStatus(enum.Enum):
    pending = 'pending'
    accepted = 'accepted'
    in_transit = 'in_transit'
    delivered = 'delivered'
    completed = 'completed'
    cancelled = 'cancelled'
    disputed = 'disputed'

class PaymentMethod(enum.Enum):
    credit = 'credit'
    debit = 'debit'
    bank_transfer = 'bank_transfer'
    crypto = 'crypto'

class PaymentStatus(enum.Enum):
    pending = 'pending'
    held = 'held'
    released = 'released'
    refunded = 'refunded'
    failed = 'failed'

class ShipmentStatus(enum.Enum):
    pending = 'pending'
    picked_up = 'picked_up'
    in_transit = 'in_transit'
    out_for_delivery = 'out_for_delivery'
    delivered = 'delivered'
    failed = 'failed'

class ContentType(enum.Enum):
    article = 'article'
    seller_post = 'seller_post'
    announcement = 'announcement'

class AdPlacement(enum.Enum):
    fyp_top = 'fyp_top'
    fyp_inline = 'fyp_inline'
    search_top = 'search_top'
    category_banner = 'category_banner'