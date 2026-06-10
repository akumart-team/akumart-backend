"""
Enumeration types for the AkuMart platform marketplace.
"""

import enum


class UserRole(enum.Enum):
    """
    System access levels and operational roles for marketplace users.
    """

    BUYER = 'buyer'
    SELLER = 'seller'
    ADMIN = 'admin'


class OrderStatus(enum.Enum):
    """
    The lifecycle states of a marketplace transaction/order.
    """

    PENDING = 'pending'
    ACCEPTED = 'accepted'
    IN_TRANSIT = 'in_transit'
    DELIVERED = 'delivered'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'
    DISPUTED = 'disputed'


class PaymentMethod(enum.Enum):
    """
    Supported payment channels for transaction settlement.
    """

    CREDIT = 'credit'
    DEBIT = 'debit'
    BANK_TRANSFER = 'bank_transfer'
    CCRYPTO = 'crypto'


class PaymentStatus(enum.Enum):
    """
    The financial lifecycle states of an escrow or payment transaction.
    """

    PENDING = 'pending'
    HELD = 'held'
    RELEASED = 'released'
    REFUNDED = 'refunded'
    FAILED = 'failed'


class ShipmentStatus(enum.Enum):
    """
    Logistical tracking states for fulfillment and delivery.
    """

    PENDING = 'pending'
    PICKED_UP = 'picked_up'
    IN_TRANSIT = 'in_transit'
    OUT_FOR_DELIVERY = 'out_for_delivery'
    DELIVERED = 'delivered'
    FAILED = 'failed'


class ContentType(enum.Enum):
    """
    Classification of content structures within the platform CMS.
    """

    ARTICLE = 'article'
    SELLER_POST = 'seller_post'
    ANNOUNCEMENT = 'announcement'


class AdPlacement(enum.Enum):
    """
    Targeted display layout regions for advertising and promoted content.
    """

    FYP_TOP = 'fyp_top'
    FYP_INLINE = 'fyp_inline'
    SEARCH_TOP = 'search_top'
    CATEGORY_BANNER = 'category_banner'


class WasteCategories(enum.Enum):
    """
    Waste Categories to classify users (buyers and sellers included)
    """

    PAPER = 'paper'
    PLASTIC = 'plastic'
    FABRIC = 'fabric'
    WOOD = 'wood'
    METAL = 'metal'
    ELECTRONIC_WASTE = 'electronic_waste'
    OTHER = 'other'
