# Archic Executable Quality Rubric v1.0

La rúbrica es la capa de criterio que complementa, pero no sustituye, al Quality Standard y al benchmark técnico.

## Release contract

Para llegar a cliente, un proyecto necesita simultáneamente:

- benchmark técnico por encima de su threshold y sin hard gates activos;
- último run `archic-rubric` en `CLIENT_READY` o `FLAGSHIP_READY`;
- smoke/journeys superados para el preview exacto.

El boundary de despliegue vuelve a comprobar la última rúbrica persistida antes de crear una decisión `final_approval`.

## Page Modes

Cada página declara un modo dominante:

- `Atmosphere`: construir deseo.
- `Explore`: recorrer opciones.
- `Decide`: elegir una entidad concreta.
- `Convert`: completar una acción.
- `Story`: construir significado.
- `Prove`: demostrar competencia.

Los once criterios cambian de peso según el modo.

## Scoring

- sección normal: `>= 16/20`;
- hero: `>= 17/20`;
- client-ready: `>= 80/100`;
- objetivo habitual: `>= 84/100`;
- flagship: `>= 90/100`;
- home: `>= 82/100`;
- páginas críticas: `>= 80/100`;
- mobile global: `>= 80/100`;
- señales AI Slop high: `0`.

Una puntuación nunca invalida un hard gate.

## Persistencia

No se introduce una tabla paralela. Cada revisión se guarda en `quality_runs` con:

- `source = 'archic-rubric'`;
- `standard_version = 'rubric-1.0'`;
- `raw_score` = score antes de penalizaciones;
- `final_score` = Archic Score;
- `input` = evidencia estructurada del reviewer;
- `output` = report calculado por Control.

## API

`GET /api/quality/rubric` devuelve el contrato activo. Requiere bearer `INTEGRATION_SECRET`.

`POST /api/quality/rubric` recibe una revisión y persiste el report calculado.

Ejemplo mínimo de página dentro de `pages`:

```json
{
  "path": "/",
  "label": "Inicio",
  "mode": "Atmosphere",
  "role": "home",
  "criteria": {
    "specificity": 8.5,
    "information_architecture": 8.5,
    "art_direction": 9,
    "photography": 9,
    "typography": 8.5,
    "layout_rhythm": 8.5,
    "components_data": 8,
    "ux_conversion": 8,
    "mobile": 8.5,
    "motion": 8,
    "robustness": 8.5
  },
  "sections": [
    {
      "id": "hero",
      "label": "Hero",
      "kind": "hero",
      "scores": { "purpose": 4, "specificity": 4, "hierarchy": 4, "composition": 4, "handoff": 3 }
    }
  ],
  "mobileScore": 85,
  "mobileFindings": [],
  "slopFindings": []
}
```

El request debe incluir además los diez `hardGates` G01–G10 con evidencia, un máximo de siete `topFixes` y las referencias Golden usadas sólo a nivel de principio.

## Golden Eight

- Borgo Santandrea
- Y.CO
- Buse Agency
- Porsche
- Aman
- Hermès
- noma
- Locomotive

Las referencias justifican principios; nunca autorizan copia literal de layouts.
