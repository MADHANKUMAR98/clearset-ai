ALTER SERVICE CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_AI
FROM SPECIFICATION $$
spec:
  containers:
    - name: clearset-ai
      image: ziaihbo-fr43183.registry.snowflakecomputing.com/clearset_db/clearset_schema/clearset_repo/clearset-ai:latest
      resources:
        requests:
          cpu: "0.5"
          memory: 512M
        limits:
          cpu: "1"
          memory: 1G
      env:
        PORT: "8080"
        SNOWFLAKE_DATABASE: "CLEARSET_DB"
        SNOWFLAKE_SCHEMA: "CLEARSET_SCHEMA"
        SNOWFLAKE_WAREHOUSE: "COMPUTE_WH"
        SNOWFLAKE_ROLE: "ACCOUNTADMIN"
      readinessProbe:
        port: 8080
        path: /api/health

  endpoints:
    - name: clearset-ui
      port: 8080
      public: true
$$;
