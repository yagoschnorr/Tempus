"""Validações de SubjectCreate / SubjectUpdate (espelham as constraints do SQL)."""
import pytest
from pydantic import ValidationError

from app.schemas.subject import SubjectCreate, SubjectUpdate


def test_create_accepts_minimal_payload():
    s = SubjectCreate(name="Cálculo I")
    assert s.name == "Cálculo I"
    assert s.color is None
    assert s.weekly_goal_minutes is None


def test_create_accepts_full_payload():
    s = SubjectCreate(
        name="Algoritmos",
        color="#a855f7",
        description="Estruturas e complexidade",
        weekly_goal_minutes=480,
    )
    assert s.color == "#a855f7"
    assert s.weekly_goal_minutes == 480


def test_create_rejects_empty_name():
    with pytest.raises(ValidationError):
        SubjectCreate(name="")


def test_create_rejects_name_over_120_chars():
    with pytest.raises(ValidationError):
        SubjectCreate(name="a" * 121)


def test_create_rejects_negative_weekly_goal():
    with pytest.raises(ValidationError):
        SubjectCreate(name="x", weekly_goal_minutes=-1)


@pytest.mark.parametrize("color", ["#fff", "534AB7", "#GGGGGG", "#5234ab7"])
def test_create_rejects_invalid_hex_color(color):
    with pytest.raises(ValidationError):
        SubjectCreate(name="x", color=color)


@pytest.mark.parametrize("color", ["#534AB7", "#ffffff", "#000000", "#a855f7"])
def test_create_accepts_valid_hex_color(color):
    SubjectCreate(name="x", color=color)


def test_update_all_fields_optional():
    s = SubjectUpdate()
    assert s.model_dump(exclude_unset=True) == {}


def test_update_can_clear_description():
    s = SubjectUpdate(description=None)
    # description=None foi explicitamente setado, deve aparecer no dump
    assert "description" in s.model_dump(exclude_unset=True)
