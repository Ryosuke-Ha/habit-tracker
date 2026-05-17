class DomainError(Exception):
    """ドメインルール違反を表す基底例外"""
    pass


class InvalidStateTransitionError(DomainError):
    """不正な状態遷移"""
    pass


class AggregateNotFoundError(DomainError):
    """集約が見つからない"""
    pass


class BusinessRuleViolationError(DomainError):
    """ビジネスルール違反"""
    pass
