import type {Course} from '../../types';
/** Loading-only illustration fallback. Ready tutorials read the live, read-only course index. */
export const tutorialExamples=[
  {
    "id": "02340114",
    "name": "מבוא למדעי המחשב מ'",
    "faculty": "הפקולטה למדעי המחשב",
    "credits": 4,
    "requirements": null,
    "requirementsStatus": "none",
    "source": {
      "url": "https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2026/200/SM/02340114",
      "term": "2026_200"
    }
  },
  {
    "id": "02340218",
    "name": "מבני נתונים 1",
    "faculty": "הפקולטה למדעי המחשב",
    "credits": 3,
    "requirements": {
      "type": "or",
      "items": [
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "02340141",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "02340124",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "02340124",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "01040286",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "01040286",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "02340122",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "02340122",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "02340141",
              "relation": "strong"
            }
          ]
        }
      ]
    },
    "requirementsStatus": "known",
    "source": {
      "url": "https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2026/200/SM/02340218",
      "term": "2026_200"
    }
  },
  {
    "id": "02340247",
    "name": "אלגוריתמים 1",
    "faculty": "הפקולטה למדעי המחשב",
    "credits": 3,
    "requirements": {
      "type": "and",
      "items": [
        {
          "type": "course",
          "courseId": "02340218",
          "relation": "strong"
        },
        {
          "type": "course",
          "courseId": "02340141",
          "relation": "strong"
        }
      ]
    },
    "requirementsStatus": "known",
    "source": {
      "url": "https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2026/200/SM/02340247",
      "term": "2026_200"
    }
  },
  {
    "id": "02340141",
    "name": "קומבינטוריקה למדעי המחשב",
    "faculty": "הפקולטה למדעי המחשב",
    "credits": 3,
    "requirements": {
      "type": "or",
      "items": [
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "01040166",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "01040195",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "01040166",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "01040031",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "01040031",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "01040016",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "01040016",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "01040195",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "01040166",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "01040012",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "01040016",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "01040031",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "course",
          "courseId": "01040016",
          "relation": "strong"
        },
        {
          "type": "course",
          "courseId": "01040012",
          "relation": "strong"
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "01040064",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "01040195",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "01040064",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "01040031",
              "relation": "strong"
            }
          ]
        }
      ]
    },
    "requirementsStatus": "known",
    "source": {
      "url": "https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2026/200/SM/02340141",
      "term": "2026_200"
    }
  },
  {
    "id": "03940902",
    "name": "נבחרות ספורט",
    "faculty": "המחלקה ללימודים הומניסטיים ואמנות",
    "credits": 1.5,
    "requirements": null,
    "requirementsStatus": "none",
    "source": {
      "url": "https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2026/200/SM/03940902",
      "term": "2026_200"
    }
  },
  {
    "id": "00140941",
    "name": "הנדסת ניקוז עילי ותת קרקעי",
    "faculty": "הפקולטה להנדסה אזרחית וסביבתית",
    "credits": 3.5,
    "requirements": {
      "type": "or",
      "items": [
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "00140205",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "00140212",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "course",
          "courseId": "00140213",
          "relation": "strong"
        }
      ]
    },
    "requirementsStatus": "known",
    "source": {
      "url": "https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2026/200/SM/00140941",
      "term": "2026_200"
    }
  },
  {
    "id": "00140205",
    "name": "הידרוליקה",
    "faculty": "הפקולטה להנדסה אזרחית וסביבתית",
    "credits": 3,
    "requirements": {
      "type": "or",
      "items": [
        {
          "type": "course",
          "courseId": "00140211",
          "relation": "strong"
        },
        {
          "type": "course",
          "courseId": "00540203",
          "relation": "strong"
        },
        {
          "type": "course",
          "courseId": "00140214",
          "relation": "strong"
        }
      ]
    },
    "requirementsStatus": "known",
    "source": {
      "url": "https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2026/200/SM/00140205",
      "term": "2026_200"
    }
  },
  {
    "id": "00140212",
    "name": "מבוא להידרולוגיה הנדסית",
    "faculty": "הפקולטה להנדסה אזרחית וסביבתית",
    "credits": 2.5,
    "requirements": {
      "type": "or",
      "items": [
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "00140211",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "00140003",
              "relation": "strong"
            }
          ]
        },
        {
          "type": "and",
          "items": [
            {
              "type": "course",
              "courseId": "00140003",
              "relation": "strong"
            },
            {
              "type": "course",
              "courseId": "00140214",
              "relation": "strong"
            }
          ]
        }
      ]
    },
    "requirementsStatus": "known",
    "source": {
      "url": "https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2026/200/SM/00140212",
      "term": "2026_200"
    }
  },
  {
    "id": "00140213",
    "name": "מבוא להידרוליקה והידרולוגיה",
    "faculty": "הפקולטה להנדסה אזרחית וסביבתית",
    "credits": 3.5,
    "requirements": {
      "type": "or",
      "items": [
        {
          "type": "course",
          "courseId": "00140211",
          "relation": "strong"
        },
        {
          "type": "course",
          "courseId": "00140214",
          "relation": "strong"
        }
      ]
    },
    "requirementsStatus": "known",
    "source": {
      "url": "https://portalex.technion.ac.il/ovv/?sap-theme=sap_belize&sap-language=HE&sap-ui-language=HE#/details/2024/201/SM/00140213",
      "term": "2024_201"
    }
  }
] satisfies Course[];
export const tutorialIds={intro:'02340114',data:'02340218',algorithms:'02340247',discrete:'02340141',sport:'03940902',requirements:'00140941'} as const;
