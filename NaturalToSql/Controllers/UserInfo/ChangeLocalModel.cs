using FastEndpoints;

namespace NaturalToQuery.Api.Controllers.UserInfo
{
    public class ChangeLocalModel:Endpoint<LocalModelRequest, LocalModelResponse>
    {
        private readonly IConfiguration _configuration;
        public ChangeLocalModel(IConfiguration configuration)
        {
            _configuration = configuration;
        }
        public override void Configure()
        {
            Put("api/userinfo/localllm");
            AllowAnonymous();
        }
        override public async Task HandleAsync(LocalModelRequest req, CancellationToken ct)
        {
            var newModel = _configuration["Groq:LocalModel"] = req.Model;
            await Send.OkAsync(new LocalModelResponse { Model = newModel }, ct);
        }
    }

    public class LocalModelResponse
    {
        public string Model { get; set; }
    }

    public class LocalModelRequest
    {
        public string Model { get; set; }
    }  
}
