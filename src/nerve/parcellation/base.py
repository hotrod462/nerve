"""Parcellation strategy protocol."""

from __future__ import annotations

from typing import Protocol

import numpy as np


class ParcellationStrategy(Protocol):
    n_parcels: int

    def aggregate(self, vertex_data: np.ndarray) -> np.ndarray:
        """
        Map vertex data to parcel means.

        vertex_data: (V,) or (T, V) → (n_parcels,) or (n_parcels, T)
        """
        ...

    def labels(self) -> list[str]:
        ...
