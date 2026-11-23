# EEHRxF Content Producer — priority category documents against the HL7 Europe content IGs.
# D5.1 api-producer-data: the EHR system SHALL be capable of providing priority category
# data that conforms to the EEHRxF data format. The SUT is any system that produces such a
# document; the tester pastes one it produced and the validator checks it against the content
# IG's Bundle profile. Slicing errors are not ignored. Use synthetic data only: never paste
# a real person's health data into a test bed.
# Positive and negative examples for each scenario: fixtures/content-v1/manifest.json.
@lang:itb-core-en@^2 @dialect:fhir-validator@^2 @actor:ContentProducer @side:producer @spec:hl7.fhir.eu.health-data-api@1.0.0-ballot
Feature: EEHRxF Content Producer — documents conform to the priority category profiles
  The SUT produces EEHRxF documents for the priority categories it claims.

  Background:
    Given ContentProducer is the system under test
    And Operator is infrastructure
    And FHIRValidator is a fhir-validator at "http://fhir-validator:8080"

  Rule: Patient Summary (HL7 Europe Patient Summary)

    @covers:content.patient-summary
    # Fixture contract: fixtures/content-v1/manifest.json, eps-valid and the eps-* invalid documents.
    Scenario: cnt-001 A Patient Summary document conforms to the European Patient Summary Bundle profile
      Given FHIRValidator is loaded with package "hl7.fhir.eu.eps#1.0.0-ballot"
      And ContentProducer is asked for $document with "Paste a Patient Summary document your system produced, as FHIR JSON (synthetic data only)"
      Then $document should conform to "http://hl7.eu/fhir/eps/StructureDefinition/bundle-eu-eps"

  Rule: Medical Test Results (HL7 Europe Laboratory Report)

    @covers:content.laboratory-report
    # Fixture contract: fixtures/content-v1/manifest.json, lab-valid and the lab-* invalid documents.
    Scenario: cnt-002 A Laboratory Report document conforms to the European Laboratory Report Bundle profile
      Given FHIRValidator is loaded with package "hl7.fhir.eu.laboratory#2.1.0"
      And ContentProducer is asked for $document with "Paste a Laboratory Report document your system produced, as FHIR JSON (synthetic data only)"
      Then $document should conform to "http://hl7.eu/fhir/laboratory/StructureDefinition/Bundle-eu-lab"

  Rule: Hospital Discharge Report (HL7 Europe Hospital Discharge Report)

    @covers:content.discharge-report
    # Fixture contract: fixtures/content-v1/manifest.json, hdr-valid and the hdr-* invalid documents.
    Scenario: cnt-003 A Hospital Discharge Report document conforms to the European Discharge Report Bundle profile
      Given FHIRValidator is loaded with package "hl7.fhir.eu.hdr#1.0.0"
      And ContentProducer is asked for $document with "Paste a Hospital Discharge Report document your system produced, as FHIR JSON (synthetic data only)"
      Then $document should conform to "http://hl7.eu/fhir/hdr/StructureDefinition/bundle-eu-hdr"
