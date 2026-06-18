"""
Enumeration types for the AkuMart platform marketplace.
"""

import enum


class UserRole(str, enum.Enum):
    """
    System access levels and operational roles for marketplace users.
    """

    BUYER = 'buyer'
    SELLER = 'seller'
    ADMIN = 'admin'


class OrderStatus(str, enum.Enum):
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


class PaymentMethod(str, enum.Enum):
    """
    Supported payment channels for transaction settlement.
    """

    CREDIT = 'credit'
    DEBIT = 'debit'
    BANK_TRANSFER = 'bank_transfer'
    CCRYPTO = 'crypto'


class PaymentStatus(str, enum.Enum):
    """
    The financial lifecycle states of an escrow or payment transaction.
    """

    PENDING = 'pending'
    HELD = 'held'
    RELEASED = 'released'
    REFUNDED = 'refunded'
    FAILED = 'failed'


class ShipmentStatus(str, enum.Enum):
    """
    Logistical tracking states for fulfillment and delivery.
    """

    PENDING = 'pending'
    PICKED_UP = 'picked_up'
    IN_TRANSIT = 'in_transit'
    OUT_FOR_DELIVERY = 'out_for_delivery'
    DELIVERED = 'delivered'
    FAILED = 'failed'


class ContentType(str, enum.Enum):
    """
    Classification of content structures within the platform CMS.
    """

    ARTICLE = 'article'
    SELLER_POST = 'seller_post'
    ANNOUNCEMENT = 'announcement'


class AdPlacement(str, enum.Enum):
    """
    Targeted display layout regions for advertising and promoted content.
    """

    FYP_TOP = 'fyp_top'
    FYP_INLINE = 'fyp_inline'
    SEARCH_TOP = 'search_top'
    CATEGORY_BANNER = 'category_banner'


class WasteCategories(str, enum.Enum):
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


class NigerianStates(str, enum.Enum):
    """
    The 36 states in Nigeria
    """

    ABIA = "Abia"
    ADAMAWA = "Adamawa"
    AKWA_IBOM = "Akwa Ibom"
    ANAMBRA = "Anambra"
    BAUCHI = "Bauchi"
    BAYELSA = "Bayelsa"
    BENUE = "Benue"
    BORNO = "Borno"
    CROSS_RIVER = "Cross River"
    DELTA = "Delta"
    EBONYI = "Ebonyi"
    EDO = "Edo"
    EKITI = "Ekiti"
    ENUGU = "Enugu"
    FCT = "FCT"
    GOMBE = "Gombe"
    IMO = "Imo"
    JIGAWA = "Jigawa"
    KADUNA = "Kaduna"
    KANO = "Kano"
    KATSINA = "Katsina"
    KEBBI = "Kebbi"
    KOGI = "Kogi"
    KWARA = "Kwara"
    LAGOS = "Lagos"
    NASARAWA = "Nasarawa"
    NIGER = "Niger"
    OGUN = "Ogun"
    ONDO = "Ondo"
    OSUN = "Osun"
    OYO = "Oyo"
    PLATEAU = "Plateau"
    RIVERS = "Rivers"
    SOKOTO = "Sokoto"
    TARABA = "Taraba"
    YOBE = "Yobe"
    ZAMFARA = "Zamfara"

class ProfileStatus(str, enum.Enum):
    """
    Profile Statuses for Seller and Buyer Profiles
    """

    INCOMPLETE = "incomplete"
    PENDING_VERIFICATION = "pending_verification"
    ACTIVE = "active"
    INACTIVE = "inactive"
