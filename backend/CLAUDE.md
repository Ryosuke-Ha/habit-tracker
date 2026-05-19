# Backend CLAUDE.md

This file provides guidance for Backend Worker Agent.

## Role
FastAPI・SQLAlchemy・Alembicの実装を担当する。

## Must Do
- JSTで日付計算すること（UTCではない）
- flake8エラーがないこと（コミット前に必ず確認）
- alembic upgrade headを実行すること（DBスキーマ変更時）
- DomainErrorはdomain/exceptions.pyを使うこと
- 型ヒントを全ての関数に付けること

## Must Not
- routerにDBクエリを直書きしない（repositoriesを使う）
- plain strでEnum値を使わない（domain/enums.pyを使う）
- 環境変数を直接コードに書かない
- get_db()を重複定義しない（database.pyのものを使う）

## Architecture Rules
- Business logic belongs in the API layer, not in routers
- Use Repository pattern for DB access
- Use Value Objects for domain concepts (WeekPeriod, YearMonth, etc.)
- Use Rich Domain Model (models have behavior, not just data)

## Key Files
| File | Purpose |
|------|---------|
| domain/value_objects.py | WeekPeriod, YearMonth, ScheduledTime |
| domain/enums.py | SessionStatus, KPTType, GoalStatus |
| domain/exceptions.py | DomainError, InvalidStateTransitionError |
| repositories/ | DB access layer |
| services/ | Cross-aggregate business logic |

## Test
```
cd backend && pytest
cd backend && flake8 .
```
