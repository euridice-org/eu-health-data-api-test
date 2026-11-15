# syntax=docker/dockerfile:1
# Same REST server as OpenTestBed/itb-plugin-fhir-validator. The fork's wip
# release is mutable, so reject changed bytes until the pin is reviewed.
FROM eclipse-temurin:17-jre@sha256:2a996a534890f1bee252fab23a0c01e773e9e1dc0e4700e8f0f6a2697c6cbf76
WORKDIR /app
ADD --checksum=sha256:1dcc7d917d0efa97bc2c889813bda881e2735dc8195e4af9bd34184ad7119731 https://github.com/costateixeira/org.hl7.fhir.core/releases/download/wip/validator_cli.jar /app/validator_cli.jar
ENV JAVA_TOOL_OPTIONS=-Xmx4g
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/validator_cli.jar"]
CMD ["server", "8080", "-version", "4.0", "-allowNetworkAccess"]
