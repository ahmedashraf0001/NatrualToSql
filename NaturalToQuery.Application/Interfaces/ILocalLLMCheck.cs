namespace NaturalToQuery.Application.Interfaces
{
    public interface ILocalLLMCheck
    {
        Task<bool> IsLocalLLMOperational(CancellationToken ct = default);
        string GetLocalLLMUrl();
    }
}